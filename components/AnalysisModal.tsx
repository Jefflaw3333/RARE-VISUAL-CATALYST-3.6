import React from 'react';

interface AnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  analysisText: string;
}

export const AnalysisModal: React.FC<AnalysisModalProps> = ({ isOpen, onClose, analysisText }) => {
  if (!isOpen) return null;

  // Simple formatter to handle basic Markdown-like syntax from Gemini
  const formatText = (text: string) => {
    if (!text) return <p className="text-slate-400 italic">No analysis available.</p>;
    
    return text.split('\n').map((line, i) => {
       // Headers
       if (line.startsWith('### ')) {
           return <h3 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.replace('### ', '')}</h3>;
       }
       if (line.startsWith('## ')) {
           return <h2 key={i} className="text-xl font-bold text-lime-400 mt-6 mb-3 border-b border-slate-700 pb-1">{line.replace('## ', '')}</h2>;
       }
       if (line.startsWith('**') && !line.endsWith('**')) {
            // Bullet points starting with bold
            const content = line.replace(/^\*\*\s*/, '');
            return <li key={i} className="mb-1 text-slate-300"><strong className="text-white">{content.split('**')[0]}</strong>{content.split('**')[1]}</li>
       }
       
       // Bold formatting within lines
       const parts = line.split(/(\*\*.*?\*\*)/g);
       return (
         <p key={i} className="mb-2 text-slate-300 leading-relaxed">
           {parts.map((part, j) => {
             if (part.startsWith('**') && part.endsWith('**')) {
               return <strong key={j} className="text-lime-300 font-semibold">{part.slice(2, -2)}</strong>;
             }
             return part;
           })}
         </p>
       );
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-lime-400">🔍</span> AI Visual Analysis
            </h2>
            <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-full text-slate-300 hover:bg-red-500 hover:text-white transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-slate-950/30 p-4 rounded-lg border border-slate-800/50">
             {formatText(analysisText)}
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end">
            <button onClick={onClose} className="px-6 py-2 bg-lime-600 hover:bg-lime-500 text-white font-bold rounded-lg transition-colors shadow-lg">
                Close Report
            </button>
        </div>
      </div>
    </div>
  );
};