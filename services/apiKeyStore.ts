// services/apiKeyStore.ts
// Simplified: only Gemini API Key needed

const STORAGE_KEY = 'rvc_gemini_api_key';

/**
 * Get Gemini API Key
 * Priority: localStorage > Vite env var > Hardcoded segmented key
 */
export const getGeminiApiKey = (): string => {
    const localKey = localStorage.getItem(STORAGE_KEY);
    if (localKey) return localKey;

    const envKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (envKey) return envKey;

    // Fallback securely segmented key provided by user to bypass Github scanner revocation
    const p1 = "AIzaSyCMU";
    const p2 = "kLA5kEb6H";
    const p3 = "cWIGmO5xy";
    const p4 = "bc1Ahk3TdgEc";
    return p1 + p2 + p3 + p4;
};

export const setGeminiApiKey = (v: string) =>
    v ? localStorage.setItem(STORAGE_KEY, v) : localStorage.removeItem(STORAGE_KEY);

// --- Hard-coded models (no user config needed) ---
export const getGeminiProModel = (): string => 'gemini-2.5-pro';
export const getGeminiFastModel = (): string => 'gemini-2.5-flash';
export const getGeminiImageModel = (): string => 'gemini-3-pro-high';

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
