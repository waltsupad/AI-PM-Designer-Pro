import React from 'react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Content */}
      <div className="relative bg-[#1a1a1f] border border-white/10 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl shadow-purple-900/20 animate-in fade-in zoom-in duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="p-8">
          <h2 className="text-3xl font-bold serif text-white mb-2">功能簡介</h2>
          <p className="text-purple-400 text-sm uppercase tracking-widest mb-8 font-semibold">AI Product Marketing Designer v1.0</p>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold text-lg border border-purple-600/30">1</div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">上傳產品圖片</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  支援 PNG 或 JPG 格式。上傳您的產品單圖，AI 總監 (Gemini 2.5 Flash) 將會自動識別產品特徵、賣點與視覺語意。
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-600/30">2</div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">選擇行銷策略</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  系統會提供三種截然不同的視覺行銷路線 (例如：科技感、生活風、極簡主義)。點擊不同的路線卡片可切換策略。
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center font-bold text-lg border border-green-600/30">3</div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">自訂與生成視覺圖</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  每個區塊都配有 AI 設計的提示詞。您可以在生成前：
                  <ul className="list-disc list-inside mt-2 space-y-1 text-gray-500">
                    <li>查看 <span className="text-gray-300">中文畫面摘要</span> 確認構圖。</li>
                    <li>編輯 <span className="text-gray-300">英文提示詞 (Prompt)</span> 以微調細節。</li>
                    <li>上傳 <span className="text-gray-300">參考圖片</span> (例如 Logo 配色或特定材質) 讓生成更精準。</li>
                  </ul>
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-600/20 text-yellow-400 flex items-center justify-center font-bold text-lg border border-yellow-600/30">4</div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">下載成果</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  滿意結果後，可直接下載高畫質圖片，或點擊右上角「下載策略報告」將完整的文字分析與 Prompt 匯出保存。
                </p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-white/10 flex justify-end">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
            >
              開始使用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};