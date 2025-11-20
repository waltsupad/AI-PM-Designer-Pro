
import { GoogleGenAI } from "@google/genai";
import { DIRECTOR_SYSTEM_PROMPT, CONTENT_PLANNER_SYSTEM_PROMPT } from "../prompts";
import { DirectorOutput, ContentPlan, MarketingRoute, ProductAnalysis } from "../types";

// --- Helpers ---

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

// --- API Calls ---

export const analyzeProductImage = async (
    file: File, 
    productName: string, 
    brandContext: string
): Promise<DirectorOutput> => {
  if (!process.env.API_KEY) {
    throw new Error("找不到 API 金鑰。請選擇一個金鑰。");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(file);

  const promptText = `
    產品名稱: ${productName || "未提供"}
    品牌/背景資訊: ${brandContext || "未提供"}
    
    請根據上述資訊與圖片，執行視覺行銷總監的分析任務。
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [imagePart, { text: promptText }],
    },
    config: {
      systemInstruction: DIRECTOR_SYSTEM_PROMPT,
      responseMimeType: "application/json",
    },
  });

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
};

export const generateContentPlan = async (
    route: MarketingRoute,
    analysis: ProductAnalysis,
    referenceCopy: string
): Promise<ContentPlan> => {
    if (!process.env.API_KEY) throw new Error("No API Key");

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const promptText = `
      選定策略路線: ${route.route_name}
      主標題: ${route.headline_zh}
      風格: ${route.style_brief_zh}
      
      產品名稱: ${analysis.name}
      產品特點: ${analysis.key_features_zh}
      
      參考文案/競品資訊: ${referenceCopy || "無 (請自行規劃最佳結構)"}
      
      請生成 8 張圖的完整內容企劃 (JSON)。
    `;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: [{ text: promptText }] },
        config: {
            systemInstruction: CONTENT_PLANNER_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 2048 } // Give it some thought for structure
        }
    });

    if (!response.text) throw new Error("Gemini Planning failed");

    try {
        return JSON.parse(cleanJson(response.text)) as ContentPlan;
    } catch (e) {
        throw new Error("企劃生成格式錯誤");
    }
};

export const generateMarketingImage = async (
    prompt: string, 
    referenceImageBase64?: string,
    aspectRatio: '1:1' | '9:16' | '3:4' | '4:3' | '16:9' = '3:4' // Default to 3:4 if not specified
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("找不到 API 金鑰。");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

  // Map custom ratio types to Gemini API allowed strings if needed, 
  // strictly Gemini 3 Pro supports "1:1", "3:4", "4:3", "9:16", "16:9"
  const finalRatio = aspectRatio; 

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: { parts: parts },
    config: {
      imageConfig: {
          aspectRatio: finalRatio,
          imageSize: "1K" // 1K is sufficient
      }
    },
  });

  const candidates = response.candidates;
  if (candidates && candidates.length > 0) {
    const parts = candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }
  }
  
  throw new Error("未生成圖片。");
};
