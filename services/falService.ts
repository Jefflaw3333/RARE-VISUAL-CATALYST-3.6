
// NOTE: This service is now hard-coded to use a specific user API key and model.
// The Google Drive save functionality has been removed in favor of returning the URL to the frontend.

const FAL_API_KEY = "71d25090-8cf6-46ab-9610-02ed341c434f:1c0f856cceba0ae404534335d3c84c9f";
const KLING_VIDEO_MODEL_URL = "https://fal.ai/api/submit/fal-ai/kling-video/v1.6/pro/image-to-video";

export const generateVideo = async (
    imageBase64: string,
    imageMimeType: string,
    videoPrompt: string,
    setStatusMessage: (msg: string) => void
): Promise<string> => {
    if (!FAL_API_KEY) {
        throw new Error("FAL_API_KEY is not configured in the application source.");
    }

    setStatusMessage("Preparing video request...");

    const imageUrl = `data:${imageMimeType};base64,${imageBase64}`;

    // Default parameters for the kling-video model
    const body = {
        "image_url": imageUrl,
        "prompt": videoPrompt,
        "duration": 5,
        "aspect_ratio": "1:1"
    };

    setStatusMessage("Sending to fal.ai...");
    
    // fal.ai has a queue system. You submit a request, get a URL to poll for the result.
    const response = await fetch(KLING_VIDEO_MODEL_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(body)
    });

    if (response.status !== 200) {
        const error = await response.json();
        console.error("Fal.ai error response:", error);
        throw new Error(`Failed to submit video generation request. The server responded with: ${error.detail || 'Request failed'}`);
    }

    // The initial response contains a URL to poll for the status
    const initialResult = await response.json();
    const resultUrl = initialResult.url;
    if (!resultUrl) {
        throw new Error("Fal.ai did not return a status URL.");
    }
    
    setStatusMessage("Video in progress...");

    // Polling logic
    let result;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes timeout (60 * 5s)

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
        const statusResponse = await fetch(resultUrl, {
            headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Accept': 'application/json' }
        });
        
        if (!statusResponse.ok) {
            throw new Error(`Failed to get status from fal.ai. Status: ${statusResponse.status}`);
        }
        
        result = await statusResponse.json();

        if (result.status === 'COMPLETED') {
            break; // Exit loop on completion
        } else if (result.status === 'ERROR') {
            throw new Error(`Video generation failed. The model reported an error: ${result.logs?.map((l: any) => l.message).join('\n') || 'Unknown model error'}`);
        }
        
        setStatusMessage(`In progress: ${result.status.toLowerCase()}...`);
        attempts++;
    }

    if (attempts >= maxAttempts) {
        throw new Error("Video generation timed out after 5 minutes. The service may be under heavy load. Please try again later.");
    }

    if (!result || result.status !== 'COMPLETED') {
        throw new Error(`Video generation failed with final status: ${result?.status || 'Unknown'}`);
    }

    // Assume the output is an array and the first item contains the video URL
    const videoUrl = result.output?.[0]?.url;
    if (!videoUrl) {
        console.error("Fal.ai final response:", result);
        throw new Error('Could not find video URL in fal.ai response.');
    }

    setStatusMessage("Success!");

    return videoUrl;
};
