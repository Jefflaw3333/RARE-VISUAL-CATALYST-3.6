
import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { editImage } from '../services/geminiService';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (newImageSrc: string) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ isOpen, onClose, imageSrc, onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && canvasRef.current && imageRef.current) {
      const canvas = canvasRef.current;
      const image = imageRef.current;
      const setCanvasSize = () => {
        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 20;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
      };
      // Image might take a moment to load, ensure dimensions are set
      if (image.complete) {
        setCanvasSize();
      } else {
        image.onload = setCanvasSize;
      }
    }
  }, [isOpen]);

  const startDrawing = (e: MouseEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.stroke();
  };

  const stopDrawing = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.closePath();
    setIsDrawing(false);
  };

  const handleClearMask = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSave = async () => {
    if (!prompt.trim() || !canvasRef.current || !imageRef.current) {
        setError('Please provide a text prompt and draw a mask on the image.');
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        // Create mask image
        const maskCanvas = document.createElement('canvas');
        const image = imageRef.current;
        maskCanvas.width = image.naturalWidth;
        maskCanvas.height = image.naturalHeight;
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) throw new Error('Could not create mask context');
        
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);

        // Draw the user's mask, scaled to the natural image size
        const scaleX = image.naturalWidth / image.clientWidth;
        const scaleY = image.naturalHeight / image.clientHeight;
        maskCtx.scale(scaleX, scaleY);
        maskCtx.drawImage(canvasRef.current, 0, 0);

        const maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
        const originalImageBase64 = imageSrc.split(',')[1];
        const originalImageMimeType = imageSrc.split(';')[0].split(':')[1];

        const newImageSrc = await editImage(originalImageBase64, originalImageMimeType, maskBase64, prompt);
        onSave(newImageSrc);
    } catch (e) {
        console.error(e);
        setError(e instanceof Error ? `Image editing failed. The API responded: ${e.message}` : 'An error occurred during editing.');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-2xl text-slate-200 space-y-4 animate-fade-in" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-white">Edit Image</h2>
        <p className="text-slate-400 text-sm">Draw on the image to select an area to change, then describe what you want to do.</p>
        <div className="relative w-full aspect-square" style={{ touchAction: 'none' }}>
            <img ref={imageRef} src={imageSrc} alt="Editing target" className="w-full h-full object-contain" />
            <canvas
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full cursor-crosshair opacity-50"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />
        </div>
        <div className="flex gap-2">
            <button onClick={handleClearMask} className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-md">Clear Mask</button>
        </div>
        <div>
          <label htmlFor="editPrompt" className="block text-sm font-medium text-slate-300">Edit Instruction</label>
          <input
            type="text"
            id="editPrompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Change shirt color to red"
            className="mt-1 block w-full bg-slate-800 border border-slate-700 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400 text-slate-100"
          />
        </div>
        {error && <div className="text-red-300 text-sm bg-red-900/50 p-2 rounded-md">{error}</div>}
        <div className="flex justify-end gap-4">
          <button onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-slate-700 text-slate-200 rounded-lg hover:bg-slate-600 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={isLoading} className="px-4 py-2 bg-lime-500 text-black font-bold rounded-lg hover:bg-lime-600 transition-colors disabled:opacity-50 disabled:cursor-wait">
            {isLoading ? 'Applying Edit...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
