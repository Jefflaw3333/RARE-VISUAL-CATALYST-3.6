import React, { useState } from 'react';
import { refineImage } from '../services/geminiService';
import type { GeneratedImage } from '../types';
import { RefreshIcon } from './icons/RefreshIcon';

interface RefineModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalImage: GeneratedImage;
  onSave: (newImage: GeneratedImage) => void;
}

const ImageRefFromSrc = (src: string) => ({
    base64: src.split(',')[1],
    mimeType: src.split(';')[0].split(':')[1],
});

export const RefineModal: React.FC<RefineModalProps> = ({ isOpen, onClose, originalImage, onSave }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!prompt.trim()) {
        setError('Please provide a prompt to refine the image.');
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const imageRef = ImageRefFromSrc(originalImage.src);
        const newImage = await refineImage(imageRef, prompt);
        onSave(newImage);
        onClose();
    } catch (e) {
        console.error(e);
        setError(e instanceof Error ? `Refinement failed. The API responded: ${e.message}` : 'An error occurred during refinement.');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-md text-slate-200 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Refine Image</h2>
            <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full text-slate-300 hover:bg-red-500 hover:text-white transition-colors" aria-label="Close">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <div className="w-full aspect-square">
            <img src={originalImage.src} alt="Original to refine" className="w-full h-full object-cover rounded-lg" />
        </div>
        
        <div>
          <label htmlFor="refinePrompt" className="block text-sm font-medium text-slate-300">Refinement Instruction</label>
          <textarea
            id="refinePrompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g., Change the background to a sandy beach with blue skies..."
            className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400 text-slate-100"
            disabled={isLoading}
          />
        </div>
        {error && <div className="text-red-300 text-sm bg-red-900/50 p-2 rounded-md">{error}</div>}
        <div className="flex justify-end gap-4">
          <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={isLoading} className="px-4 py-2 bg-lime-500 text-black font-bold rounded-lg hover:bg-lime-600 transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-2">
            {isLoading && <RefreshIcon className="h-4 w-4 animate-spin" />}
            {isLoading ? 'Refining...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
};