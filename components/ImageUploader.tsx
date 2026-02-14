
import React, { useRef, useState, MouseEvent } from 'react';

type FocusArea = { x: number; y: number; width: number; height: number; };

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  uploadedImage: string | null;
  onFocusAreaChange?: (area: FocusArea | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, uploadedImage, onFocusAreaChange }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // State for focus selection
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{x: number, y: number} | null>(null);
  const [selection, setSelection] = useState<FocusArea | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelection(null);
      if(onFocusAreaChange) onFocusAreaChange(null);
      onImageUpload(event.target.files[0]);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      setSelection(null);
      if(onFocusAreaChange) onFocusAreaChange(null);
      onImageUpload(event.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };
  
  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleClearSelection = () => {
    setSelection(null);
    if (onFocusAreaChange) {
      onFocusAreaChange(null);
    }
  };

  // Focus Area Selection Handlers
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!onFocusAreaChange || !imageRef.current) return;
    setIsSelecting(true);
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPoint({ x, y });
    setSelection({ x, y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !startPoint || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    
    // Boundary checks to keep selection within the image
    const boundedX = Math.max(0, x);
    const boundedY = Math.max(0, y);
    const boundedWidth = Math.min(width, rect.width - boundedX);
    const boundedHeight = Math.min(height, rect.height - boundedY);

    setSelection({ x: boundedX, y: boundedY, width: boundedWidth, height: boundedHeight });
  };

  const handleMouseUp = () => {
    if (!isSelecting || !selection || !imageRef.current || !onFocusAreaChange) return;
    setIsSelecting(false);
    setStartPoint(null);
    
    // Convert display pixels to natural image pixels for accurate cropping
    const img = imageRef.current;
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;

    const naturalSelection = {
        x: Math.round(selection.x * scaleX),
        y: Math.round(selection.y * scaleY),
        width: Math.round(selection.width * scaleX),
        height: Math.round(selection.height * scaleY),
    };
    
    // Only finalize selection if it has a meaningful size
    if (naturalSelection.width > 10 && naturalSelection.height > 10) {
        onFocusAreaChange(naturalSelection);
    } else {
        // If selection is too small, discard it
        setSelection(null);
        onFocusAreaChange(null);
    }
  };

  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/png, image/jpeg, image/webp"
      />
      {uploadedImage ? (
        <div className="mt-2 text-center">
          <div 
            className="relative inline-block select-none"
            onMouseDown={onFocusAreaChange ? handleMouseDown : undefined}
            onMouseMove={onFocusAreaChange && isSelecting ? handleMouseMove : undefined}
            onMouseUp={onFocusAreaChange && isSelecting ? handleMouseUp : undefined}
            onMouseLeave={onFocusAreaChange && isSelecting ? handleMouseUp : undefined} // End selection if mouse leaves
          >
            <img 
              ref={imageRef}
              src={uploadedImage} 
              alt="Uploaded preview" 
              className="max-h-60 w-full object-cover rounded-lg mx-auto shadow-md"
              draggable="false" // Prevents native image drag
            />
            {selection && onFocusAreaChange && (
              <div 
                className="absolute border-2 border-dashed border-cyan-400 bg-cyan-400/30"
                style={{
                  left: `${selection.x}px`,
                  top: `${selection.y}px`,
                  width: `${selection.width}px`,
                  height: `${selection.height}px`,
                }}
              />
            )}
          </div>
           <div className="mt-4 flex justify-center items-center gap-4">
              <button onClick={handleClick} className="text-sm text-indigo-400 hover:text-indigo-300">
                Change Image
              </button>
              {selection && onFocusAreaChange && (
                  <button onClick={handleClearSelection} className="text-sm text-red-400 hover:text-red-300">
                    Clear Focus
                  </button>
              )}
           </div>
        </div>
      ) : (
        <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${isDragging ? 'border-indigo-500' : 'border-gray-600'} border-dashed rounded-md cursor-pointer transition-colors duration-300`}
        >
          <div className="space-y-1 text-center">
             <svg className="mx-auto h-12 w-12 text-gray-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex text-sm text-gray-400">
              <p className="pl-1">Click to upload or drag and drop</p>
            </div>
            <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
          </div>
        </div>
      )}
    </div>
  );
};
