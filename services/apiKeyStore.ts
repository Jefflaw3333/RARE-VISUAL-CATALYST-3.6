// services/apiKeyStore.ts
// Centralized localStorage management for API keys and configuration

const KEYS = {
    GEMINI: 'rvc_gemini_api_key',
    GEMINI_ENDPOINT: 'rvc_gemini_endpoint',
    GEMINI_PRO_MODEL: 'rvc_gemini_pro_model',
    GEMINI_FAST_MODEL: 'rvc_gemini_fast_model',
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

/**
 * Pro model: used for heavy tasks only (~20% of calls)
 * - Main social copy generation (with images)
 * - Image generation
 * - Image analysis
 */
export const getGeminiProModel = (): string => {
    const val = get(KEYS.GEMINI_PRO_MODEL)
        || get('rvc_gemini_text_model'); // migrate old key
    const deprecated = ['gemini-3-pro-preview', 'gemini-3-pro-image-preview'];
    return (val && !deprecated.includes(val)) ? val : 'gemini-3-pro-high';
};
export const setGeminiProModel = (v: string) => set(KEYS.GEMINI_PRO_MODEL, v);

// Keep old getter as alias for backward compat
export const getGeminiTextModel = getGeminiProModel;
export const setGeminiTextModel = setGeminiProModel;

/**
 * Fast model: used for lightweight tasks (~80% of calls)
 * - Brainstorm angle generation
 * - Creative prompt writing
 * - Expanded content copy
 * Defaults to gemini-1.5-flash — cheaper, still high quality for text tasks.
 */
export const getGeminiFastModel = (): string => {
    const val = get(KEYS.GEMINI_FAST_MODEL);
    return val || 'gemini-1.5-flash';
};
export const setGeminiFastModel = (v: string) => set(KEYS.GEMINI_FAST_MODEL, v);

/**
 * Image generation model (vision output)
 */
export const getGeminiImageModel = (): string => {
    const val = get(KEYS.GEMINI_IMAGE_MODEL);
    const deprecated = ['gemini-3-pro-image-preview'];
    return (val && !deprecated.includes(val)) ? val : 'gemini-3-pro-high';
};
export const setGeminiImageModel = (v: string) => set(KEYS.GEMINI_IMAGE_MODEL, v);

// --- FAL ---
export const getFalApiKey = (): string => get(KEYS.FAL);
export const setFalApiKey = (v: string) => set(KEYS.FAL, v);

// --- Batch operations (for Modal) ---
export interface ApiKeys {
    geminiApiKey: string;
    geminiEndpoint: string;
    geminiProModel: string;
    geminiFastModel: string;
    geminiImageModel: string;
    falApiKey: string;
}

export const getAllKeys = (): ApiKeys => ({
    geminiApiKey: get(KEYS.GEMINI),
    geminiEndpoint: get(KEYS.GEMINI_ENDPOINT),
    geminiProModel: get(KEYS.GEMINI_PRO_MODEL) || get('rvc_gemini_text_model') || 'gemini-3-pro-high',
    geminiFastModel: get(KEYS.GEMINI_FAST_MODEL) || 'gemini-1.5-flash',
    geminiImageModel: get(KEYS.GEMINI_IMAGE_MODEL) || 'gemini-3-pro-high',
    falApiKey: get(KEYS.FAL),
});

export const saveAllKeys = (keys: ApiKeys) => {
    set(KEYS.GEMINI, keys.geminiApiKey);
    set(KEYS.GEMINI_ENDPOINT, keys.geminiEndpoint);
    set(KEYS.GEMINI_PRO_MODEL, keys.geminiProModel);
    set(KEYS.GEMINI_FAST_MODEL, keys.geminiFastModel);
    set(KEYS.GEMINI_IMAGE_MODEL, keys.geminiImageModel);
    set(KEYS.FAL, keys.falApiKey);
};

export const clearAllKeys = () => {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
};
