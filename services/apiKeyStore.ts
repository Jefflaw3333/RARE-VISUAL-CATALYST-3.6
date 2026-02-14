// services/apiKeyStore.ts
// Centralized localStorage management for API keys and configuration

const KEYS = {
    GEMINI: 'rvc_gemini_api_key',
    GEMINI_ENDPOINT: 'rvc_gemini_endpoint',
    GEMINI_TEXT_MODEL: 'rvc_gemini_text_model',
    GEMINI_IMAGE_MODEL: 'rvc_gemini_image_model',
    FAL: 'rvc_fal_api_key',
} as const;

const get = (k: string): string => localStorage.getItem(k) ?? '';
const set = (k: string, v: string) => v ? localStorage.setItem(k, v) : localStorage.removeItem(k);

// --- Gemini ---
export const getGeminiApiKey = (): string => get(KEYS.GEMINI);
export const setGeminiApiKey = (v: string) => set(KEYS.GEMINI, v);

export const getGeminiEndpoint = (): string => get(KEYS.GEMINI_ENDPOINT);
export const setGeminiEndpoint = (v: string) => set(KEYS.GEMINI_ENDPOINT, v);

export const getGeminiTextModel = (): string => {
    const val = get(KEYS.GEMINI_TEXT_MODEL);
    return (val && val !== 'gemini-3-pro-preview') ? val : 'gemini-3-pro-high';
};
export const setGeminiTextModel = (v: string) => set(KEYS.GEMINI_TEXT_MODEL, v);

export const getGeminiImageModel = (): string => {
    const val = get(KEYS.GEMINI_IMAGE_MODEL);
    return (val && val !== 'gemini-3-pro-image-preview') ? val : 'gemini-3-pro-high';
};
export const setGeminiImageModel = (v: string) => set(KEYS.GEMINI_IMAGE_MODEL, v);

// --- FAL ---
export const getFalApiKey = (): string => get(KEYS.FAL);
export const setFalApiKey = (v: string) => set(KEYS.FAL, v);

// --- Batch operations (for Modal) ---
export interface ApiKeys {
    geminiApiKey: string;
    geminiEndpoint: string;
    geminiTextModel: string;
    geminiImageModel: string;
    falApiKey: string;
}

export const getAllKeys = (): ApiKeys => ({
    geminiApiKey: get(KEYS.GEMINI),
    geminiEndpoint: get(KEYS.GEMINI_ENDPOINT),
    geminiTextModel: get(KEYS.GEMINI_TEXT_MODEL),
    geminiImageModel: get(KEYS.GEMINI_IMAGE_MODEL),
    falApiKey: get(KEYS.FAL),
});

export const saveAllKeys = (keys: ApiKeys) => {
    set(KEYS.GEMINI, keys.geminiApiKey);
    set(KEYS.GEMINI_ENDPOINT, keys.geminiEndpoint);
    set(KEYS.GEMINI_TEXT_MODEL, keys.geminiTextModel);
    set(KEYS.GEMINI_IMAGE_MODEL, keys.geminiImageModel);
    set(KEYS.FAL, keys.falApiKey);
};

export const clearAllKeys = () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
};
