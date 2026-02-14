
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { GeneratedData, SocialPosts, GeneratedImage, FocusImageRef, ProductInfo, GeneratedPerspective, VideoPromptConfig, ImageRef, GenerationOptions, CustomLifestyle } from "../types";

// Helper to get authenticated client with current API Key
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found. Please connect your API key to use Nano Banana Pro.");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper for retry logic with exponential backoff
async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await operation();
    } catch (error: any) {
        const isOverloaded = error?.status === 503 || error?.code === 503 || (error?.message && error.message.toLowerCase().includes('overloaded')) || (error?.message && error.message.toLowerCase().includes('unavailable'));
        if (retries > 0 && isOverloaded) {
            console.warn(`Model overloaded or unavailable (503). Retrying in ${delay}ms... (${retries} retries left)`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return retryOperation(operation, retries - 1, delay * 2);
        }
        throw error;
    }
}

// Helper to safely extract parts from a response
const getParts = (response: any) => {
    return response.candidates?.[0]?.content?.parts || [];
};

// Helper: Calculate closest valid aspect ratio
const calculateClosestAspectRatio = (aspectRatio: string, customDims?: { width: number, height: number }): string => {
    if (aspectRatio !== 'custom') return aspectRatio;
    if (!customDims || customDims.width === 0 || customDims.height === 0) return '1:1';
    const ratio = customDims.width / customDims.height;
    const standards = [
        { id: '1:1', value: 1.0 },
        { id: '16:9', value: 16/9 },
        { id: '9:16', value: 9/16 },
        { id: '4:3', value: 4/3 },
        { id: '3:4', value: 3/4 },
    ];
    let closestId = '1:1';
    let minDiff = Number.MAX_VALUE;
    for (const std of standards) {
        const diff = Math.abs(ratio - std.value);
        if (diff < minDiff) {
            minDiff = diff;
            closestId = std.id;
        }
    }
    return closestId;
};

const allSocialProperties: { [key: string]: any } = {
    facebook: { type: Type.STRING, description: 'A caption for Facebook.' },
    instagram: { type: Type.STRING, description: 'A caption for Instagram.' },
    tiktok: { type: Type.STRING, description: 'A script idea or caption for a TikTok.' },
    youtube: { type: Type.STRING, description: 'A title and description for YouTube.' },
    pinterest: { type: Type.STRING, description: 'A Pin title and caption.' },
    x: { type: Type.STRING, description: 'A short caption for X.' },
    blog: { type: Type.STRING, description: 'A short blog post idea.' }
};

const socialCopySchema = {
    type: Type.OBJECT,
    properties: {
        english_post: { type: Type.STRING },
        chinese_post: { type: Type.STRING }
    },
    required: ['english_post', 'chinese_post']
};

const perspectiveLabelMap: { [key: string]: string } = {
    extremeWideShot: 'Extreme Wide Shot',
    mediumCloseUp: 'Medium Close-up',
    pov: 'POV',
    birdsEyeView: "Bird's Eye View",
    wormsEyeView: "Worm's Eye View",
    trackingShot: 'Tracking Shot',
    closeUp: 'Close-up',
    nearView: 'Near View',
    midView: 'Mid View',
    farView: 'Far View',
    heroShot: 'Hero Shot',
    knolling: 'Knolling',
    dutchAngle: 'Dutch Angle',
    overShoulder: 'Over-the-Shoulder',
    frontView: 'Front View',
    topDown: 'Top-down',
    lowAngle: 'Low-Angle Shot',
    sideView: 'Side View',
    upperBody: 'Upper Body',
    lowerBody: 'Lower Body',
    product_frontView: 'Product: Front View',
    product_threeQuarterLeft: 'Product: Three-Quarter Left',
    product_threeQuarterRight: 'Product: Three-Quarter Right',
    product_profileLeft: 'Product: Profile Left',
    product_profileRight: 'Product: Profile Right',
    product_backView: 'Product: Back View',
    product_topDown: 'Product: Top-Down',
    product_bottomUp: 'Product: Bottom-Up',
    product_45degreeAbove: 'Product: 45° Above',
    product_macroShot: 'Product: Macro Shot',
};

const styleFilterPromptMap: { [key: string]: string } = {
    'fuji_classic_chrome': "Fuji Classic Chrome: Subdued colors, high contrast, documentary feel.",
    'fuji_classic_negative': "Fuji Classic Negative: Nostalgic, muted but rich colors.",
    'fuji_provia_velvia': "Fuji Provia / Velvia: Vibrant colors, cinematic atmosphere.",
    'fuji_acros': "Fuji Acros: High-contrast monochrome, fine grain.",
    'kodak_portra_400': "Kodak Portra: Warm skin tones, professional film look.",
    'kodak_gold_200': "Kodak Gold 200: Warm nostalgic vintage vibe.",
    'kodak_kodachrome': "Kodachrome: Saturated colors, legendary 70s look.",
    'leica_look': "Leica Look: High dynamic range, sharp, European aesthetic.",
    'cinematic_teal_orange': "Teal & Orange: Blockbuster movie grade.",
    'cinematic_wes_anderson': "Wes Anderson: Symmetrical, pastel, whimsical.",
    'cinematic_cyberpunk': "Cyberpunk: Neon blues and purples, noir.",
    'social_vsco': "VSCO A4/A6: Clean, faded highlights, trendy minimalist.",
    'social_huji': "Huji Cam: 90s disposable look, light leaks.",
    'social_gingham': "Gingham: Soft washed-out look, warm haze.",
    'moody_dark': "Moody Dark: Low saturation, deep shadows.",
    'soft_pastel': "Soft Pastel: Clean bright tones, ethereal.",
    'street_gritty': "Street Gritty: Cool tones, raw authentic texture.",
    'bw_ilford_hp5': "Ilford HP5: Classic photojournalism monochrome.",
    'bw_tri_x': "Kodak Tri-X: High contrast gritty grain.",
    'bw_noir': "Film Noir: High contrast chiaroscuro lighting.",
    'art_vaporwave': "Vaporwave: Neon grid, retro 80s glitch.",
    'art_dreamcore': "Dreamcore: Surreal liminality, soft focus.",
    'art_oil_painting': "Oil Painting: Classical brush stroke texture.",
    'fashion_voguestyle': "Vogue Editorial: Bold, high-end studio polish.",
    'fashion_high_key': "High Key Studio: Bright, commercial, minimal shadow."
};

const strategyPromptMap: { [key: string]: string } = {
    authenticity: "Authentic, relatable, UGC feel.",
    humor: "Humorous, playful, witty voice.",
    niche: "Niche focused, specialized language.",
    ai_collab: "Transparent AI co-creation tone.",
    fast_paced: "High energy, Reels/TikTok hooks.",
    educational: "Knowledgeable expert guide tone.",
    bts: "Behind-the-scenes storytelling.",
    ugc: "Community-focused, celebratory user voice."
};

const parseDescription = (text: string | undefined): { en: string; cn: string } => {
    if (!text) return { en: 'No description available.', cn: '无可用描述。' };
    try {
        const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonString);
        return { en: parsed.en || '...', cn: parsed.cn || '...' };
    } catch (e) {
        return { en: text.substring(0, 150) + "...", cn: '请查看图片。' };
    }
};

const descriptionInstruction = `\n\nFinally, provide a short one-sentence descriptive caption in both English and Chinese. Format as JSON: {"en": "...", "cn": "..."}.`;

async function generateSocialCopyForImage(image: ImageRef, productInfo: ProductInfo): Promise<{ en: string; cn: string; }> {
    const ai = getAiClient();
    const imagePart = { inlineData: { data: image.base64, mimeType: image.mimeType } };
    const socialCopyPrompt = `Expert copywriter persona. Analyze image for product: ${productInfo.name}. Create engaging post. Output JSON: {"english_post": "...", "chinese_post": "..."}`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [imagePart, { text: socialCopyPrompt }] },
        config: { responseMimeType: "application/json", responseSchema: socialCopySchema }
    });
    const parsed = JSON.parse(response.text.trim());
    return { en: parsed.english_post, cn: parsed.chinese_post };
}

interface CreativePromptResult {
    imagePrompt: string;
    veoPrompt: string;
    originalAngleId: string;
    variationIndex: number;
}

async function generateCreativeImagePrompts(
    imageParts: any[],
    expandedAnglesWithIds: { angle: string, id: string, index: number }[],
    productInfo: ProductInfo,
    generationDescription: string,
    generationOptions: GenerationOptions,
    customLifestyle: CustomLifestyle
): Promise<CreativePromptResult[]> {
    const ai = getAiClient();
    const { lifestyleScene, selectedSocialStrategies, consistencyMode, sensualMode, ugcMode, styleFilter, creativityBoost, targetRegion, targetAudience, selectedFocusSubjects } = generationOptions;
    
    const combinedAtmosphere = [...lifestyleScene.atmosphere, customLifestyle.atmosphere].filter(Boolean).join(', ');
    const styleFilterDesc = styleFilter ? styleFilterPromptMap[styleFilter] : "Clean professional photography";
    const socialStrategyContext = selectedSocialStrategies.length > 0 ? selectedSocialStrategies.map(s => strategyPromptMap[s]).join('\n') : "Standard professional.";
    const focusContext = selectedFocusSubjects && selectedFocusSubjects.length > 0 ? selectedFocusSubjects.join(', ') : 'Whole Product';

    // Flexible UGC / Lo-Fi Authenticity Logic
    const ugcInstruction = ugcMode 
        ? `
        *** SPECIAL STYLE MODE: LO-FI AUTHENTICITY (UGC) ***
        The user wants to evoke "Digital Imperfection" to build trust, but implies different types of authenticity.
        DO NOT simply apply a "bad quality" filter to everything.
        
        Generate a variety of authentic "snapshot" styles across the different angles:
        
        1. "The Party Flash": Hard direct flash, high contrast, dark background (snapshot aesthetic).
        2. "The Daylight Casual": Soft, slightly blown-out window light, messy real-life background (lifestyle vlog aesthetic).
        3. "The Textural Crop": High ISO, visible grain/noise, focus on product texture, slightly soft focus (artsy amateur aesthetic).
        4. "The Quick Snap": Slightly off-center composition, motion blur on background elements, uncurated environment (candid aesthetic).
        
        General rules for this mode:
        - Avoid "studio perfection", "perfect bokeh", or "artificial softbox lighting".
        - Use "shot on iPhone", "posted on Snapchat", "raw photo", "no filter" as style guides.
        - Ensure the product remains the clear focus, even if the vibe is "messy".
        ` 
        : "";

    const promptRequest = `Visual Director Persona. 
    Product: ${productInfo.name}. 
    User Goal: ${generationDescription}. 
    Atmosphere: ${combinedAtmosphere}. 
    Style: ${styleFilterDesc}. 
    
    ${ugcInstruction}
    
    Strategy: ${socialStrategyContext}. 
    Creativity: ${creativityBoost ? 'High' : 'Standard'}. 
    Consistency: ${consistencyMode ? 'Strict' : 'Off'}. 
    Sensual: ${sensualMode ? 'High-end boudoir' : 'Off'}.
    Target Region: ${targetRegion || 'Global'}.
    Target Audience: ${targetAudience || 'General'}.
    Emphasis/Focus Details: ${focusContext}.
    
    Write rich prompts for each angle below. Ensure the "Emphasis/Focus Details" are highlighted in the prompt for every angle if applicable.
    ${ugcMode ? 'Ensure every single prompt adheres to the Lo-Fi/UGC aesthetic instructions above, varying the specific type of authenticity (flash vs daylight vs texture).' : ''}
    
    Output JSON: { "perspectives": [ { "imagePrompt": "...", "veoPrompt": "..." } ] } 
    Angles: ${expandedAnglesWithIds.map(a => a.angle).join('\n')}`;

    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [...imageParts, { text: promptRequest }] },
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { perspectives: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { imagePrompt: { type: Type.STRING }, veoPrompt: { type: Type.STRING } } } } } } }
    });
    const parsed = JSON.parse(response.text.trim());
    return parsed.perspectives.map((p: any, i: number) => ({ ...p, originalAngleId: expandedAnglesWithIds[i].id, variationIndex: expandedAnglesWithIds[i].index }));
}

export async function generateBrainstormAngles(mainImage: ImageRef, productInfo: ProductInfo): Promise<string[]> {
    const ai = getAiClient();
    const imagePart = { inlineData: { data: mainImage.base64, mimeType: mainImage.mimeType } };
    const prompt = `Analyze product: ${productInfo.name}. Suggest 3 creative high-impact camera angles. JSON: { "angles": ["Idea 1", "..."] }`;
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: { parts: [imagePart, { text: prompt }] },
        config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { angles: { type: Type.ARRAY, items: { type: Type.STRING } } } } }
    });
    const parsed = JSON.parse(response.text.trim());
    return parsed.angles || [];
}

export const generateContentFromImage = async (
    mainImage: ImageRef,
    secondaryImages: ImageRef[],
    focusImageRef: FocusImageRef,
    referenceImages: ImageRef[],
    productInfo: ProductInfo,
    generationOptions: GenerationOptions,
    customLifestyle: CustomLifestyle,
    generationDescription: string,
    setLoadingMessage: (message: string) => void
): Promise<GeneratedData> => {
    setLoadingMessage('Analysing images & creative direction...');
    const ai = getAiClient();
    const mainImagePart = { inlineData: { data: mainImage.base64, mimeType: mainImage.mimeType } };
    const secondaryImageParts = secondaryImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    const referenceImageParts = referenceImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    const allImageParts: any[] = [mainImagePart, ...secondaryImageParts, ...referenceImageParts];
    setLoadingMessage('Crafting social strategy & copy...');
    const { selectedSocialPlatforms, selectedSocialStrategies, selectedAngles, generateSocialCopy, aspectRatio, customDimensions, imagesPerAngle = 1 } = generationOptions;
    const targetAspectRatio = calculateClosestAspectRatio(aspectRatio || '1:1', customDimensions);
    let socialPosts: SocialPosts = {};
    try {
        const selectedSocialProperties: { [key: string]: any } = {};
        selectedSocialPlatforms.forEach(platform => {
            const key = platform.toLowerCase();
            if (allSocialProperties[key]) selectedSocialProperties[key] = allSocialProperties[key];
        });
        const dynamicSocialMediaSchema = { type: Type.OBJECT, properties: selectedSocialProperties };
        const strategyInstruction = selectedSocialStrategies.length > 0 ? `Tone/Strategy: ${selectedSocialStrategies.map(id => strategyPromptMap[id]).join(', ')}` : '';
        const socialPrompt = `Social Manager Persona. Copy for: ${selectedSocialPlatforms.join(', ')}. Product: ${productInfo.name}. ${strategyInstruction}. Goal: ${generationDescription}`;
        const socialResponse = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', contents: { parts: [...allImageParts, { text: socialPrompt }] }, config: { responseMimeType: "application/json", responseSchema: dynamicSocialMediaSchema }
        });
        const parsedSocial = JSON.parse(socialResponse.text.trim());
        selectedSocialPlatforms.forEach(platform => {
            const key = platform.toLowerCase() as keyof SocialPosts;
            if(parsedSocial[key]) socialPosts[key] = parsedSocial[key];
        });
    } catch (e) {}
    setLoadingMessage(`Designing perspectives...`);
    const expandedAnglesWithIds: { angle: string, id: string, index: number }[] = [];
    selectedAngles.forEach(angleId => { for(let i=0; i<imagesPerAngle; i++) { expandedAnglesWithIds.push({ angle: imagesPerAngle > 1 ? `${angleId} (Var ${i+1})` : angleId, id: angleId, index: i + 1 }); } });
    let creativePerspectives: CreativePromptResult[] = [];
    try {
        creativePerspectives = await generateCreativeImagePrompts([mainImagePart, ...referenceImageParts], expandedAnglesWithIds, productInfo, generationDescription, generationOptions, customLifestyle);
    } catch (e) {
        creativePerspectives = expandedAnglesWithIds.map(item => ({ imagePrompt: `Pro shot of ${productInfo.name}, ${item.angle}.`, veoPrompt: `Cinematic video of ${item.angle}.`, originalAngleId: item.id, variationIndex: item.index }));
    }
    setLoadingMessage(`Rendering images (Nano Banana Pro)...`);
    let perspectives: GeneratedPerspective[] = [];
    try {
        const perspectivePromises = creativePerspectives.map(async (perspectiveData) => {
            const { originalAngleId, variationIndex, imagePrompt, veoPrompt } = perspectiveData;
            const partsForGeneration = [...allImageParts];
            if (focusImageRef) partsForGeneration.push({ inlineData: { data: focusImageRef.base64, mimeType: focusImageRef.mimeType } });
            partsForGeneration.push({ text: `Generate image: "${imagePrompt}". ${descriptionInstruction}` });
            
            // WRAP WITH RETRY
            const imageResponse = await retryOperation(() => ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: { parts: partsForGeneration },
                config: {
                    imageConfig: { aspectRatio: targetAspectRatio, imageSize: "1K" }
                }
            }));
            
            const parts = getParts(imageResponse);
            const imagePart = parts.find(part => part.inlineData);
            const textPart = parts.find(part => part.text);
            if (!imagePart || !imagePart.inlineData) return null;
            const base64Image = imagePart.inlineData.data;
            const mimeType = imagePart.inlineData.mimeType;
            const src = `data:${mimeType};base64,${base64Image}`;
            const description = parseDescription(textPart?.text);
            let label = originalAngleId.startsWith('custom:') ? originalAngleId.substring('custom:'.length) : perspectiveLabelMap[originalAngleId] || originalAngleId;
            if (imagesPerAngle > 1) label = `${label} #${variationIndex}`;
            const uniqueId = `${originalAngleId}-${variationIndex}-${Date.now()}`;
            const perspective: GeneratedPerspective = { id: uniqueId, label, prompt: imagePrompt, veoPrompt, mainImage: { src, label, description } };
            if (generateSocialCopy) { try { perspective.socialCopy = await generateSocialCopyForImage({ base64: base64Image, mimeType }, productInfo); } catch (e) {} }
            return perspective;
        });
        const resolvedPerspectives = await Promise.all(perspectivePromises);
        perspectives = resolvedPerspectives.filter((p): p is GeneratedPerspective => p !== null);
    } catch (e: any) { throw new Error(`Image generation failed: ${e.message}`); }
    return { socialPosts, perspectives };
};

export const generateSingleImage = async (prompt: string, mainImage: ImageRef, secondaryImages: ImageRef[], focusImageRef: FocusImageRef | null, referenceImages: ImageRef[], aspectRatio?: string, customDimensions?: { width: number, height: number }): Promise<GeneratedImage> => {
    const ai = getAiClient();
    const partsForGeneration: any[] = [{ inlineData: { data: mainImage.base64, mimeType: mainImage.mimeType } }, ...secondaryImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })), ...referenceImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }))];
    if (focusImageRef) partsForGeneration.push({ inlineData: { data: focusImageRef.base64, mimeType: focusImageRef.mimeType } });
    partsForGeneration.push({ text: prompt + descriptionInstruction });
    const targetAspectRatio = calculateClosestAspectRatio(aspectRatio || '1:1', customDimensions);
    
    // WRAP WITH RETRY
    const response = await retryOperation(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: partsForGeneration },
        config: {
            imageConfig: { aspectRatio: targetAspectRatio, imageSize: "1K" }
        }
    }));
    
    const parts = getParts(response);
    const imagePart = parts.find(part => part.inlineData);
    const textPart = parts.find(part => part.text);
    if (imagePart && imagePart.inlineData) return { src: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`, label: 'Regenerated', description: parseDescription(textPart?.text) };
    
    // Detailed error for regeneration failures (often safety blocks)
    // Cast to any to access candidates which might be missing on type definition but present in response
    const reason = (response as any).candidates?.[0]?.finishReason || "UNKNOWN";
    if (reason === "SAFETY") {
        throw new Error("Image was blocked by safety filters. Try a different angle or less suggestive prompt.");
    }
    throw new Error(`Image regeneration failed. (Reason: ${reason})`);
};

export const generateMoreImages = async (mainImage: ImageRef, secondaryImages: ImageRef[], focusImageRef: FocusImageRef, referenceImages: ImageRef[], productInfo: ProductInfo, generationOptions: GenerationOptions, customLifestyle: CustomLifestyle, existingPerspectives: GeneratedPerspective[], expansionPrompt: string, setLoadingMessage: (message: string) => void): Promise<GeneratedPerspective[]> => {
    const ai = getAiClient();
    setLoadingMessage("Using Gemini 3.0 to create new creative angles...");
    const mainImagePart = { inlineData: { data: mainImage.base64, mimeType: mainImage.mimeType } };
    const secondaryImageParts = secondaryImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    const referenceImageParts = referenceImages.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    const existingImageParts = existingPerspectives.map(p => ({ inlineData: { data: p.mainImage.src.split(',')[1], mimeType: p.mainImage.src.split(';')[0].split(':')[1] } }));
    const { generateSocialCopy, aspectRatio, customDimensions } = generationOptions;
    const targetAspectRatio = calculateClosestAspectRatio(aspectRatio || '1:1', customDimensions);
    const basePrompt = `Continuing photoshoot for ${productInfo.name}. Goal: "${expansionPrompt}".`;
    const allReferenceImageParts = [mainImagePart, ...secondaryImageParts, ...referenceImageParts, ...existingImageParts];
    if (focusImageRef) allReferenceImageParts.push({ inlineData: { data: focusImageRef.base64, mimeType: focusImageRef.mimeType } });
    setLoadingMessage("Rendering expanded images...");
    const imagePromises = [1, 2].map(async (num) => {
        const partsForGeneration = [...allReferenceImageParts, { text: basePrompt + "\n" + descriptionInstruction }];
        
        // WRAP WITH RETRY
        const res = await retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: partsForGeneration },
            config: {
                imageConfig: { aspectRatio: targetAspectRatio, imageSize: "1K" }
            }
        }));
        
        const parts = getParts(res);
        const imagePart = parts.find(part => part.inlineData);
        const textPart = parts.find(part => part.text);
        if (imagePart && imagePart.inlineData) {
            const src = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            const perspective: GeneratedPerspective = { id: `expansion-${Date.now()}-${num}`, label: expansionPrompt.substring(0, 15) + `... (${num})`, prompt: basePrompt, veoPrompt: `Cinematic video.`, mainImage: { src, label: 'Expansion', description: parseDescription(textPart?.text) } };
            if (generateSocialCopy) { try { perspective.socialCopy = await generateSocialCopyForImage({ base64: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType }, productInfo); } catch (e) {} }
            return perspective;
        }
        return null;
    });
    const newPerspectives = await Promise.all(imagePromises);
    return newPerspectives.filter((p): p is GeneratedPerspective => p !== null);
};

export const editImage = async (originalImageBase64: string, originalImageMimeType: string, maskBase64: string, prompt: string): Promise<string> => {
    const ai = getAiClient();
    
    // WRAP WITH RETRY
    const response = await retryOperation(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [ { inlineData: { data: originalImageBase64, mimeType: originalImageMimeType } }, { inlineData: { data: maskBase64, mimeType: 'image/png' } }, { text: `Edit masked area: "${prompt}". ${descriptionInstruction}` } ]},
        config: {
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
    }));
    
    const parts = getParts(response);
    const imagePart = parts.find(part => part.inlineData);
    if (imagePart && imagePart.inlineData) return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    throw new Error("Image editing failed.");
};

export const refineImage = async (originalImage: ImageRef, refinePrompt: string): Promise<GeneratedImage> => {
    const ai = getAiClient();
    
    // WRAP WITH RETRY
    const response = await retryOperation(() => ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [ { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } }, { text: `Refine image: "${refinePrompt}". ${descriptionInstruction}` } ]},
        config: {
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
    }));
    
    const parts = getParts(response);
    const imagePart = parts.find(part => part.inlineData);
    const textPartResponse = parts.find(part => part.text);
    if (imagePart && imagePart.inlineData) return { src: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`, label: 'Refined', description: parseDescription(textPartResponse?.text) };
    throw new Error("Image refinement failed.");
};

export const generateImageVariations = async (originalImage: ImageRef): Promise<GeneratedImage[]> => {
    const ai = getAiClient();
    const imagePromises = [1, 2, 3].map(() => 
        // WRAP WITH RETRY
        retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [ { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } }, { text: `Generate variation. ${descriptionInstruction}` } ]},
            config: {
                imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
            }
        }))
    );
    const results = await Promise.all(imagePromises);
    return results.map((res): GeneratedImage | null => { 
        const parts = getParts(res); 
        const i = parts.find(p => p.inlineData); 
        const t = parts.find(p => p.text); 
        if (i && i.inlineData) return { src: `data:${i.inlineData.mimeType};base64,${i.inlineData.data}`, label: 'Variation', description: parseDescription(t?.text) }; 
        return null; 
    }).filter((v): v is GeneratedImage => v !== null);
};

export const extendFrameForVideo = async (originalImage: ImageRef): Promise<{ extendedImages: GeneratedImage[], transitionText: { en: string, cn: string } }> => {
    const ai = getAiClient();
    const imagePart = { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } };
    const prompts = [{ p: "Zoom out.", l: "Zoom Out" }, { p: "Extend left.", l: "Pan Left" }, { p: "Extend up.", l: "Tilt Up" }, { p: "Extend right.", l: "Pan Right" }];
    const imagePromises = prompts.map(({ p, l }) => 
        // WRAP WITH RETRY
        retryOperation(() => ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts: [imagePart, { text: p + descriptionInstruction }] },
            config: {
                imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
            }
        })).then(res => { const parts = getParts(res); const i = parts.find(pt => pt.inlineData); const t = parts.find(pt => pt.text); if (i && i.inlineData) return { src: `data:${i.inlineData.mimeType};base64,${i.inlineData.data}`, label: l, description: parseDescription(t?.text) }; throw new Error('Fail'); })
    );
    const textPromise = ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [imagePart, { text: "JSON: {en, cn} transition text." }] }, config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { en: { type: Type.STRING }, cn: { type: Type.STRING } } } } }).then(res => JSON.parse(res.text.trim()));
    const [extendedImages, transitionText] = await Promise.all([Promise.all(imagePromises), textPromise]);
    return { extendedImages, transitionText };
};

export const analyzeImage = async (imageRef: ImageRef): Promise<string> => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({ model: 'gemini-3-pro-preview', contents: { parts: [ { inlineData: { data: imageRef.base64, mimeType: imageRef.mimeType } }, { text: `Detailed visual analysis covering composition, lighting, color, subject, and atmosphere.` } ]}, });
    return response.text;
};
