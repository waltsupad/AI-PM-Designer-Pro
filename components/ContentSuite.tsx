
import React, { useState } from 'react';
import { ContentPlan, ContentItem } from '../types';
import { generateMarketingImage } from '../services/geminiService';
import { Spinner } from './Spinner';

interface ContentSuiteProps {
  plan: ContentPlan;
  referenceImage?: string | null; // Passed from parent if user uploaded one globally
}

const ContentCard: React.FC<{ item: ContentItem; globalRefImage?: string | null }> = ({ item, globalRefImage }) => {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the item's ratio
      const result = await generateMarketingImage(item.visual_prompt_en, globalRefImage || undefined, item.ratio);
      setImage(result);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  // Dynamic classes based on ratio
  const containerClass = item.ratio === '1:1' 
    ? "aspect-square w-full" 
    : "aspect-[9/16] w-full";
  
  const labelClass = item.ratio === '1:1' 
    ? "bg-blue-500/20 text-blue-300 border-blue-500/30" 
    : "bg-pink-500/20 text-pink-300 border-pink-500/30";

  return (
    <div className="flex flex-col gap-3 group">
        {/* Image Area */}
        <div className={`relative rounded-xl overflow-hidden bg-[#15151a] border border-white/10 hover:border-white/30 transition-colors shadow-lg ${containerClass}`}>
            {image ? (
                <div className="relative w-full h-full">
                    <img src={image} alt={item.title_zh} className="w-full h-full object-cover" />
                    <a href={image} download={`${item.id}.png`} className="absolute top-2 right-2 p-2 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                         <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    </a>
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
                    {loading ? (
                        <Spinner className="w-8 h-8 text-purple-500" />
                    ) : (
                        <button 
                            onClick={handleGenerate}
                            className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-purple-600 hover:text-white transition-all text-gray-500"
                        >
                             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    )}
                </div>
            )}
            {/* Type Label */}
            <div className={`absolute top-2 left-2 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm ${labelClass}`}>
                {item.ratio} | {item.type.replace('_', ' ')}
            </div>
        </div>

        {/* Text Info */}
        <div className="space-y-1">
            <h4 className="text-sm font-bold text-white leading-tight">{item.title_zh}</h4>
            <p className="text-xs text-gray-400 line-clamp-2" title={item.copy_zh}>{item.copy_zh}</p>
            <details className="group/details">
                <summary className="text-[10px] text-gray-600 cursor-pointer hover:text-gray-400 list-none flex items-center gap-1 mt-1">
                    <span>▶ 畫面摘要</span>
                </summary>
                <p className="text-[10px] text-gray-500 mt-1 pl-2 border-l border-gray-700">
                    {item.visual_summary_zh}
                </p>
            </details>
            {error && <p className="text-[10px] text-red-400">{error}</p>}
        </div>
    </div>
  );
};

export const ContentSuite: React.FC<ContentSuiteProps> = ({ plan, referenceImage }) => {
  const mainImages = plan.items.filter(i => i.ratio === '1:1');
  const storySlides = plan.items.filter(i => i.ratio === '9:16');

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex items-center gap-3 mb-8">
            <div className="h-px flex-1 bg-white/10"></div>
            <h2 className="text-2xl font-bold text-white serif text-center">
                <span className="block text-xs text-purple-400 font-sans uppercase tracking-widest mb-1">Phase 2</span>
                {plan.plan_name}
            </h2>
            <div className="h-px flex-1 bg-white/10"></div>
        </div>

        {/* Section 1: Main Images (Square) */}
        <div className="mb-12">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                方形主圖 (Main Visuals)
                <span className="text-xs font-normal text-gray-500 ml-2">1000 x 1000 px</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {mainImages.map(item => (
                    <ContentCard key={item.id} item={item} globalRefImage={referenceImage} />
                ))}
            </div>
        </div>

        {/* Section 2: Story Slides (Portrait) */}
        <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-pink-500 rounded-full"></span>
                內容介紹組圖 (Story Suite)
                <span className="text-xs font-normal text-gray-500 ml-2">900 x 1600 px</span>
            </h3>
            {/* Horizontal scroll on mobile, grid on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
                {storySlides.map(item => (
                    <ContentCard key={item.id} item={item} globalRefImage={referenceImage} />
                ))}
            </div>
        </div>
    </div>
  );
};
