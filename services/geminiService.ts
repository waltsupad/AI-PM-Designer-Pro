import { GoogleGenAI } from "@google/genai";
import { DIRECTOR_SYSTEM_PROMPT, CONTENT_PLANNER_SYSTEM_PROMPT } from "../prompts";
import { DirectorOutput, ContentPlan, MarketingRoute, ProductAnalysis, ContentItem } from "../types";

// --- Helpers ---

const getApiKey = (): string => {
  // First try localStorage (for deployed app)
  const storedKey = localStorage.getItem('gemini_api_key');
  if (storedKey) return storedKey;

  // Fallback to process.env (for local dev if set)
  if (process.env.API_KEY) return process.env.API_KEY;

  throw new Error("找不到 API 金鑰。請在設定中輸入您的 Gemini API Key。");
};

const cleanJson = (text: string): string => {
  let clean = text.trim();
  if (clean.startsWith("```json")) {
    clean = clean.replace(/^```json/, "").replace(/```$/, "");
  } else if (clean.startsWith("```")) {
    clean = clean.replace(/^```/, "").replace(/```$/, "");
  }
  return clean.trim();
};

export const fileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  const base64String = await fileToBase64(file);
  const base64EncodedData = base64String.split(",")[1];
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
};

// --- Robust Error Serializer ---

const serializeError = (error: any): string => {
  try {
    if (typeof error === 'string') return error;
    
    // 如果是標準 Error 物件，JSON.stringify 通常會回傳 {}，所以要手動提取
    if (error instanceof Error) {
      const errObj: any = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
      // 嘗試提取可能掛載在 error 上的額外屬性 (如 Google SDK 常用的 response, status, statusText)
      const customProps = Object.getOwnPropertyNames(error).reduce((acc: any, key) => {
        if (key !== 'name' && key !== 'message' && key !== 'stack') {
          acc[key] = (error as any)[key];
        }
        return acc;
      }, {});
      
      return JSON.stringify({ ...errObj, ...customProps }, null, 2);
    }

    // 如果是純物件 (如 fetch 回傳的 JSON error)
    return JSON.stringify(error, null, 2);
  } catch (e) {
    return String(error);
  }
};

// --- Retry Logic Helper (Exponential Backoff) ---

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  initialDelay: number = 2000,
  factor: number = 2
): Promise<T> {
  let currentDelay = initialDelay;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      // 如果是最後一次嘗試，直接拋出錯誤
      if (attempt > retries) {
        console.warn(`[Gemini Retry] Exhausted all ${retries} retries. Last error:`, error);
        throw error;
      }

      // 1. 序列化錯誤以進行完整文字比對
      const errorStr = serializeError(error);

      // 2. 取得 Status Code (強制轉為 Number 以避免 "429" !== 429 的型別錯誤)
      // GoogleGenAIError 可能在 error.status, error.code, 或是 response.status
      let status = 0;
      if (error.status) status = Number(error.status);
      else if (error.code) status = Number(error.code);
      else if (error.error?.code) status = Number(error.error.code);

      // 3. 判斷特徵 (包含 Google 特有的錯誤碼與字串)
      const isRateLimit = 
          status === 429 ||
          errorStr.includes("429") || 
          errorStr.includes("RESOURCE_EXHAUSTED") || 
          errorStr.includes("quota") || 
          errorStr.includes("Too Many Requests");
          
      const isServerBusy = 
          status === 503 ||
          errorStr.includes("503") || 
          errorStr.includes("Overloaded");
      
      const isFetchError = 
          errorStr.includes("fetch") || 
          errorStr.includes("network") || 
          errorStr.includes("Failed to fetch");

      if (isRateLimit || isServerBusy || isFetchError) {
        console.warn(`[Gemini Retry] Attempt ${attempt}/${retries} failed (Status: ${status}). Retrying in ${currentDelay}ms...`);
        console.debug(`[Gemini Retry] Error causing retry:`, errorStr);
        await wait(currentDelay);
        currentDelay *= factor;
      } else {
        // 如果是 400 (Bad Request), 401 (Auth), 403 (Permission) 等無法透過重試解決的錯誤，直接拋出
        throw error;
      }
    }
  }
  
  throw new Error("Unexpected retry loop exit");
}

// --- Error Handling Helper ---

const handleGeminiError = (error: any): never => {
  console.error("Gemini API Error Details:", error);

  // 取得最原始的 JSON 錯誤字串，不加任何修飾，讓使用者直接除錯
  const rawErrorString = serializeError(error);

  // 直接拋出包含原始錯誤的訊息
  throw new Error(`[RAW SERVER RESPONSE]:\n${rawErrorString}`);
};

// --- API Calls ---

export const analyzeProductImage = async (
    file: File, 
    productName: string, 
    brandContext: string
): Promise<DirectorOutput> => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    
    const imagePart = await fileToGenerativePart(file);

    const promptText = `
      產品名稱: ${productName || "未提供"}
      品牌/背景資訊: ${brandContext || "未提供"}
      
      請根據上述資訊與圖片，執行視覺行銷總監的分析任務。
    `;

    const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [imagePart, { text: promptText }],
            },
            config: {
                systemInstruction: DIRECTOR_SYSTEM_PROMPT,
                responseMimeType: "application/json",
            },
        });
    }, 3, 2000); // Flash 模型重試 3 次

    if (!response.text) {
      throw new Error("Gemini 沒有回應文字");
    }

    try {
      const cleaned = cleanJson(response.text);
      return JSON.parse(cleaned) as DirectorOutput;
    } catch (e) {
      console.error("Failed to parse JSON", response.text);
      throw new Error("AI 總監返回了無效的格式。請再試一次。");
    }
  } catch (error) {
    handleGeminiError(error);
    return {} as DirectorOutput;
  }
};

export const generateContentPlan = async (
    route: MarketingRoute,
    analysis: ProductAnalysis,
    referenceCopy: string
): Promise<ContentPlan> => {
    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });

      const promptText = `
        選定策略路線: ${route.route_name}
        主標題: ${route.headline_zh}
        風格: ${route.style_brief_zh}
        
        產品名稱: ${analysis.name}
        產品特點: ${analysis.key_features_zh}
        
        參考文案/競品資訊: ${referenceCopy || "無 (請自行規劃最佳結構)"}
        
        請生成 8 張圖的完整內容企劃 (JSON)。
      `;

      const response = await retryWithBackoff(async () => {
          return await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: { parts: [{ text: promptText }] },
              config: {
                  systemInstruction: CONTENT_PLANNER_SYSTEM_PROMPT,
                  responseMimeType: "application/json",
                  thinkingConfig: { thinkingBudget: 1024 } 
              }
          });
      }, 3, 2000);

      if (!response.text) throw new Error("Gemini Planning failed");

      try {
          return JSON.parse(cleanJson(response.text)) as ContentPlan;
      } catch (e) {
          throw new Error("企劃生成格式錯誤");
      }
    } catch (error) {
      handleGeminiError(error);
      return {} as ContentPlan;
    }
};

export const generateMarketingImage = async (
    prompt: string, 
    referenceImageBase64?: string,
    aspectRatio: '1:1' | '9:16' | '3:4' | '4:3' | '16:9' = '3:4'
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const parts: any[] = [{ text: prompt }];

    if (referenceImageBase64) {
      const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
          parts.push({
              inlineData: {
                  data: match[2],
                  mimeType: match[1]
              }
          });
      }
    }

    // 使用高品質模型 gemini-3-pro-image-preview
    // 重試策略強化：Pro Image 模型較容易觸發限流，增加重試次數至 5 次
    // 延遲策略：5s -> 10s -> 20s -> 40s -> 80s (總共可覆蓋超過 2 分鐘的等待)
    const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
            model: "gemini-3-pro-image-preview",
            contents: { parts: parts },
            config: {
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: "1K" 
                }
            },
        });
    }, 5, 5000, 2); 

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("未生成圖片 (No image data in response)");
  } catch (error) {
    handleGeminiError(error);
    return "";
  }
};

export const generateFullReport = (
  analysis: ProductAnalysis,
  routes: MarketingRoute[],
  selectedRouteIndex: number,
  contentPlan: ContentPlan,
  editedPlanItems: ContentItem[]
): string => {
  const route = routes[selectedRouteIndex];
  const date = new Date().toLocaleDateString();

  let report = `AI PM Designer PRO v2.0 - Product Marketing Strategy Report\n`;
  report += `Date: ${date}\n`;
  report += `=================================================\n\n`;

  report += `[PRODUCT ANALYSIS]\n`;
  report += `Name: ${analysis.name}\n`;
  report += `Visual Description: ${analysis.visual_description}\n`;
  report += `Key Features: ${analysis.key_features_zh}\n\n`;

  report += `[SELECTED STRATEGY: ${route.route_name}]\n`;
  report += `Headline: ${route.headline_zh}\n`;
  report += `Subhead: ${route.subhead_zh}\n`;
  report += `Style: ${route.style_brief_zh}\n\n`;

  report += `[PHASE 1: CONCEPT VISUALS]\n`;
  route.image_prompts.forEach((p, i) => {
    report += `Poster ${i + 1}:\n`;
    report += `Summary: ${p.summary_zh}\n`;
    report += `Prompt: ${p.prompt_en}\n\n`;
  });

  report += `-------------------------------------------------\n`;
  report += `[PHASE 2: CONTENT SUITE PLAN]\n`;
  report += `Plan Name: ${contentPlan.plan_name}\n\n`;

  editedPlanItems.forEach((item) => {
    report += `--- Slide: ${item.type} (${item.ratio}) ---\n`;
    report += `Title: ${item.title_zh}\n`;
    report += `Copy: ${item.copy_zh}\n`;
    report += `Visual Summary: ${item.visual_summary_zh}\n`;
    report += `PROMPT:\n${item.visual_prompt_en}\n\n`;
  });

  return report;
};