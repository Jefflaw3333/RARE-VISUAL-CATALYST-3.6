// services/apiKeyStore.ts
// Simplified: only Gemini API Key needed

const STORAGE_KEY = 'rvc_gemini_api_key';

/**
 * Get Gemini API Key
 * Priority: localStorage > Vite env var (baked at build time)
 */
export const getGeminiApiKey = (): string =>
    localStorage.getItem(STORAGE_KEY) ?? import.meta.env.VITE_GEMINI_API_KEY ?? '';

export const setGeminiApiKey = (v: string) =>
    v ? localStorage.setItem(STORAGE_KEY, v) : localStorage.removeItem(STORAGE_KEY);

// --- Hard-coded models (no user config needed) ---
export const getGeminiProModel = (): string => 'gemini-2.5-pro';
export const getGeminiFastModel = (): string => 'gemini-2.5-flash';
export const getGeminiImageModel = (): string => 'gemini-3-pro-image-preview';

// Backward compat aliases
export const getGeminiTextModel = getGeminiProModel;

// --- Batch ops (for Modal) ---
export interface ApiKeys {
    geminiApiKey: string;
}

export const getAllKeys = (): ApiKeys => ({
    geminiApiKey: getGeminiApiKey(),
});

export const saveAllKeys = (keys: ApiKeys) => {
    setGeminiApiKey(keys.geminiApiKey);
};

export const clearAllKeys = () => {
    localStorage.removeItem(STORAGE_KEY);
};
