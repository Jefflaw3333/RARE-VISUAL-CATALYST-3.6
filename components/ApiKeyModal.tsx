import React, { useState, useEffect } from 'react';
import { getAllKeys, saveAllKeys, clearAllKeys, type ApiKeys } from '../services/apiKeyStore';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
    const [keys, setKeys] = useState<ApiKeys>(getAllKeys());
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setKeys(getAllKeys());
            setSaved(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        saveAllKeys(keys);
        setSaved(true);
        setTimeout(() => onClose(), 600);
    };

    const handleClear = () => {
        clearAllKeys();
        setKeys({ geminiApiKey: '' });
        setSaved(false);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-fade-in" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-white">API Configuration</h2>
                        <p className="text-xs text-slate-400 mt-0.5">Enter your Gemini API Key to get started</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                        Gemini API Key <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showKey ? 'text' : 'password'}
                            value={keys.geminiApiKey}
                            onChange={e => { setKeys({ geminiApiKey: e.target.value }); setSaved(false); }}
                            placeholder="AIzaSy..."
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-lime-500/50 focus:border-lime-500 transition-colors"
                        />
                        <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-lime-400 transition-colors"
                        >
                            {showKey ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">
                        Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-lime-500 hover:text-lime-400 underline">Google AI Studio</a>
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between bg-slate-900/50">
                    <button
                        onClick={handleClear}
                        className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                        Clear
                    </button>
                    <div className="flex items-center gap-3">
                        {saved && <span className="text-xs text-lime-400 animate-pulse">✓ Saved</span>}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!keys.geminiApiKey.trim()}
                            className="px-5 py-2 bg-lime-600 hover:bg-lime-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-lime-900/30"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
