/**
 * 使用 Zod 進行執行時型別驗證
 */
import { z } from 'zod';
import { ProductAnalysis, MarketingRoute, DirectorOutput, ContentItem, ContentPlan } from '../types';

// ProductAnalysis Schema - 使用更寬鬆的驗證
export const ProductAnalysisSchema = z.object({
  name: z.string().min(1, '產品名稱不能為空'),
  visual_description: z.string().min(5, '視覺描述至少需要 5 個字元'), // 降低要求
  key_features_zh: z.string().min(5, '核心賣點至少需要 5 個字元'), // 降低要求
});

// PromptData Schema - 使用更寬鬆的驗證
export const PromptDataSchema = z.object({
  prompt_en: z.string().min(20, '提示詞至少需要 20 個字元'), // 降低要求
  summary_zh: z.string().optional().default(''), // 允許省略或空字串
});

// MarketingRoute Schema - 使用更寬鬆的驗證
export const MarketingRouteSchema = z.object({
  route_name: z.string().min(1).max(50), // 放寬長度限制
  headline_zh: z.string().min(1).max(100), // 放寬長度限制
  subhead_zh: z.string().min(1).max(200), // 放寬長度限制
  style_brief_zh: z.string().min(5), // 降低要求
  target_audience_zh: z.string().optional(),
  visual_elements_zh: z.string().optional(),
  image_prompts: z.array(PromptDataSchema).min(1).max(10), // 允許 1-10 個，不強制恰好 3 個
});

// DirectorOutput Schema - 使用更寬鬆的驗證
export const DirectorOutputSchema = z.object({
  product_analysis: ProductAnalysisSchema,
  marketing_routes: z.array(MarketingRouteSchema).min(1).max(10), // 允許 1-10 條路線
});

// ContentItem Schema
export const ContentItemSchema = z.object({
  id: z.string().regex(/^img_\d+_(white|lifestyle|hook|problem|solution|features|trust|cta)$/, 'ID 格式不正確'),
  type: z.enum(['main_white', 'main_lifestyle', 'story_slide']),
  ratio: z.enum(['1:1', '9:16', '16:9']),
  title_zh: z.string().min(5).max(30),
  copy_zh: z.string().min(20).max(100),
  visual_prompt_en: z.string().min(50).max(500),
  visual_summary_zh: z.string().min(10).max(50),
});

// ContentPlan Schema
export const ContentPlanSchema = z.object({
  plan_name: z.string().min(10).max(50),
  items: z.array(ContentItemSchema).length(8, '必須包含恰好 8 個內容項目'),
});

/**
 * 驗證並解析 DirectorOutput
 * 使用 safeParse 並嘗試修復常見問題
 */
export const validateDirectorOutput = (data: unknown): DirectorOutput => {
  // 先嘗試直接解析
  const result = DirectorOutputSchema.safeParse(data);
  
  if (result.success) {
    return result.data;
  }
  
  // 如果失敗，嘗試修復常見問題
  if (typeof data === 'object' && data !== null) {
    const fixed = { ...data } as Record<string, unknown>;
    
    // 確保 marketing_routes 是陣列
    if (!Array.isArray(fixed.marketing_routes)) {
      fixed.marketing_routes = [];
    }
    
    // 確保每個 route 都有 image_prompts
    if (Array.isArray(fixed.marketing_routes)) {
      fixed.marketing_routes = fixed.marketing_routes.map((route: unknown) => {
        if (typeof route === 'object' && route !== null) {
          const routeObj = route as Record<string, unknown>;
          if (!Array.isArray(routeObj.image_prompts)) {
            routeObj.image_prompts = [];
          }
          // 確保每個 prompt 都有 summary_zh
          if (Array.isArray(routeObj.image_prompts)) {
            routeObj.image_prompts = routeObj.image_prompts.map((prompt: unknown) => {
              if (typeof prompt === 'object' && prompt !== null) {
                const promptObj = prompt as Record<string, unknown>;
                if (!promptObj.summary_zh) {
                  promptObj.summary_zh = '';
                }
                return promptObj;
              }
              return prompt;
            });
          }
          return routeObj;
        }
        return route;
      });
    }
    
    // 再次嘗試解析修復後的資料
    const retryResult = DirectorOutputSchema.safeParse(fixed);
    if (retryResult.success) {
      console.warn('驗證失敗後成功修復資料格式');
      return retryResult.data;
    }
  }
  
  // 如果還是失敗，記錄詳細錯誤並拋出
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
  console.error('API 回應格式驗證失敗：', result.error);
  console.error('原始資料：', JSON.stringify(data, null, 2));
  throw new Error(`API 回應格式驗證失敗：\n${errors}`);
};

/**
 * 驗證並解析 ContentPlan
 * 使用 safeParse 並嘗試修復常見問題
 */
export const validateContentPlan = (data: unknown): ContentPlan => {
  // 先嘗試直接解析
  const result = ContentPlanSchema.safeParse(data);
  
  if (result.success) {
    return result.data;
  }
  
  // 如果失敗，記錄詳細錯誤
  const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n');
  console.error('內容企劃格式驗證失敗：', result.error);
  console.error('原始資料：', JSON.stringify(data, null, 2));
  throw new Error(`內容企劃格式驗證失敗：\n${errors}`);
};

/**
 * 驗證使用者輸入
 */
export const validateProductName = (name: string): { valid: boolean; error?: string } => {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: '產品名稱不能為空' };
  }
  if (name.length > 100) {
    return { valid: false, error: '產品名稱不能超過 100 個字元' };
  }
  return { valid: true };
};

export const validateBrandContext = (context: string): { valid: boolean; error?: string } => {
  if (context.length > 5000) {
    return { valid: false, error: '品牌資訊不能超過 5000 個字元' };
  }
  return { valid: true };
};

export const validateRefCopy = (copy: string): { valid: boolean; error?: string } => {
  if (copy.length > 10000) {
    return { valid: false, error: '參考文案不能超過 10000 個字元' };
  }
  return { valid: true };
};

