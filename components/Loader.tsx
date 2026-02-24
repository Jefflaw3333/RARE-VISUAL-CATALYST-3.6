import React from 'react';

interface LoaderProps {
  message: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-900/80 p-8 rounded-xl border-2 border-dashed border-slate-700 backdrop-blur-sm">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-lime-400"></div>
      <p className="mt-6 text-xl font-semibold text-white">Generating Content...</p>
      <p className="mt-2 text-slate-400">{message || 'Please wait a moment.'}</p>
    </div>
  );
};