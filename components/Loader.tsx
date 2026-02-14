import React from 'react';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-in-right">
      <div className="flex items-center gap-4 bg-slate-900/95 p-4 pr-6 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-md">
        <div className="relative">
          <div className="w-10 h-10 border-3 border-slate-700 rounded-full"></div>
          <div className="absolute top-0 left-0 w-10 h-10 border-3 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white tracking-wide">GENERATING CONTENT</span>
          <span className="text-xs text-slate-400 font-mono">{message || 'Processing...'}</span>
        </div>
      </div>
    </div>
  );
};