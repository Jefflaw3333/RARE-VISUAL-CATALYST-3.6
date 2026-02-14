import React, { useState, useEffect } from 'react';
import { generateImageVariations } from '../services/geminiService';
import { Loader } from './Loader';
import type { GeneratedImage } from '../types';

interface VariationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: GeneratedImage;
  onReplace: (newImage: GeneratedImage) => void;
}

const ImageRefFromSrc = (src: string) => ({
    base64: src.split(',')[1],
    mimeType: src.split(';')[0].split(':')[1],
});

export const VariationsModal: React.FC<VariationsModalProps> = ({ isOpen, onClose, originalImage, onReplace }) => {
  const [variations, setVariations] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && originalImage) {
      const fetchVariations = async () => {
        setIsLoading(true);
        setError(null);
        setVariations([]);
        try {
          const imageRef = ImageRefFromSrc(originalImage.src);
          const results = await generateImageVariations(imageRef);
          setVariations(results);
        } catch (e) {
          setError(e instanceof Error ? `Failed to generate variations. The API responded: ${e.message}` : 'Failed to generate variations.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchVariations();
    }
  }, [isOpen, originalImage]);

  const handleReplace = (variation: GeneratedImage) => {
    onReplace(variation);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-4xl text-slate-200 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start">
            <div>
                <h2 className="text-2xl font-bold text-white">Generate Variations</h2>
                <p className="text-slate-400 text-sm">Choose a variation to replace the original image.</p>
            </div>
            <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full text-slate-300 hover:bg-red-500 hover:text-white transition-colors" aria-label="Close">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="md:col-span-1">
                <h3 className="text-center font-semibold mb-2 text-slate-400">Original</h3>
                <img src={originalImage.src} alt="Original" className="w-full aspect-square object-cover rounded-lg ring-2 ring-lime-400" />
            </div>
            <div className="md:col-span-3">
                 <h3 className="text-center font-semibold mb-2 text-slate-300">New Variations</h3>
                 {isLoading && (
                    <div className="grid grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                             <div key={i} className="aspect-square bg-slate-800 rounded-lg flex items-center justify-center animate-pulse">
                                 <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
                             </div>
                        ))}
                    </div>
                 )}
                 {error && <div className="text-red-300 text-sm bg-red-900/50 p-3 rounded-md text-center">{error}</div>}
                 {!isLoading && !error && (
                     <div className="grid grid-cols-3 gap-4">
                        {variations.map((variation, i) => (
                            <div key={i} className="group relative">
                                <img src={variation.src} alt={`Variation ${i+1}`} className="w-full aspect-square object-cover rounded-lg" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-xs text-center text-white truncate rounded-b-lg">
                                    {variation.label}
                                </div>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button onClick={() => handleReplace(variation)} className="bg-lime-500 text-black font-bold px-4 py-2 rounded-lg text-sm hover:bg-lime-600">
                                        Replace
                                    </button>
                                </div>
                            </div>
                        ))}
                     </div>
                 )}
            </div>
        </div>
      </div>
    </div>
  );
};