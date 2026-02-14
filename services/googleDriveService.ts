
import type { GeneratedData } from "../types";

// Add ambient declarations for Google APIs loaded from script tags
declare global {
    // FIX: Augment the Window interface to declare gapi and google properties.
    // This resolves TypeScript errors about these properties not existing on `window`.
    interface Window {
        gapi: any;
        google: any;
    }
}

const API_KEY = process.env.GOOGLE_DRIVE_API_KEY;
const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export const isGoogleDriveConfigured = (): boolean => {
    return !!API_KEY && !!CLIENT_ID;
};

let tokenClient: any | null = null;
let gapiInited = false;
let gisInited = false;
let initPromise: Promise<void> | null = null;

// This function ensures that both GAPI and GIS are loaded and initialized,
// and it's designed to be called multiple times without re-initializing.
const initializeGoogleClients = (): Promise<void> => {
    if (initPromise) {
        return initPromise;
    }

    initPromise = new Promise((resolve, reject) => {
        const checkGapi = () => {
            if (window.gapi && window.gapi.client) {
                // FIX: Use window.gapi to access the global gapi object.
                window.gapi.load('client', {
                    callback: () => {
                        if (!API_KEY) {
                            return reject(new Error("Google Drive API Key is not configured."));
                        }
                        // FIX: Use window.gapi to access the global gapi object.
                        window.gapi.client.init({
                            apiKey: API_KEY,
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                        }).then(() => {
                            gapiInited = true;
                            if (gisInited) resolve();
                        }).catch(reject);
                    },
                    onerror: reject,
                });
            } else {
                setTimeout(checkGapi, 100);
            }
        };

        const checkGis = () => {
            if (window.google && window.google.accounts && window.google.accounts.oauth2) {
                 if (!CLIENT_ID) {
                    return reject(new Error("Google Drive Client ID is not configured."));
                 }
                try {
                    // FIX: Use window.google to access the global google object.
                    tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: CLIENT_ID,
                        scope: SCOPES,
                        callback: () => {}, // Callback is handled by the promise logic in handleAuthClick
                    });
                    gisInited = true;
                    if (gapiInited) resolve();
                } catch (err) {
                    reject(err);
                }
            } else {
                setTimeout(checkGis, 100);
            }
        };

        checkGapi();
        checkGis();
    });


    return initPromise;
};


// Utility to convert base64 to Blob
const base64ToBlob = (base64: string, contentType = '', sliceSize = 512) => {
    const byteCharacters = atob(base64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
};

const handleAuthClick = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!tokenClient) {
            return reject(new Error('Google Identity client not initialized.'));
        }
        
        // FIX: Use window.gapi to access the global gapi object.
        const token = window.gapi.client.getToken();
        if (token && token.access_token) {
           return resolve();
        }

        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                return reject(new Error(`Google Authentication failed. Please ensure pop-ups are allowed and try again. Error: ${resp.error}`));
            }
            // FIX: Use window.gapi to access the global gapi object.
            window.gapi.client.setToken(resp);
            resolve();
        };

        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
};


const getOrCreateFolder = async (folderName: string, parentId?: string): Promise<string> => {
    try {
        let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
        if (parentId) {
            query += ` and '${parentId}' in parents`;
        }

        // FIX: Use window.gapi to access the global gapi object.
        const response = await window.gapi.client.drive.files.list({ q: query, fields: 'files(id, name)' });

        if (response.result.files && response.result.files.length > 0) {
            return response.result.files[0].id!;
        } else {
            const fileMetadata = {
                name: folderName,
                mimeType: 'application/vnd.google-apps.folder',
                ...(parentId && { parents: [parentId] })
            };
            // FIX: Use window.gapi to access the global gapi object.
            const createResponse = await window.gapi.client.drive.files.create({
                resource: fileMetadata,
                fields: 'id'
            });
            return createResponse.result.id!;
        }
    } catch (e: any) {
        throw new Error(`Failed to create or find folder '${folderName}' in Google Drive. Error: ${e.message}`);
    }
};

const uploadFile = async (folderId: string, blob: Blob, filename: string) => {
    const metadata = {
        name: filename,
        parents: [folderId],
    };
    
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            // FIX: Use window.gapi to access the global gapi object.
            'Authorization': `Bearer ${window.gapi.client.getToken().access_token}`,
        },
        body: form,
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(`Failed to upload ${filename} to Google Drive. The server responded with: ${error.error.message}`);
    }
};

export const saveToDrive = async (data: GeneratedData, campaignFolderName: string, setStatusMessage: (msg: string) => void): Promise<void> => {
    try {
        setStatusMessage('Initializing Google services...');
        await initializeGoogleClients();
        
        setStatusMessage('Authenticating with Google Drive...');
        await handleAuthClick();
        
        setStatusMessage('Creating folder in Google Drive...');
        const rootFolderId = await getOrCreateFolder('Content Catalyst Engine Exports');
        const campaignFolderId = await getOrCreateFolder(campaignFolderName, rootFolderId);

        // Map perspectives to images including prompt data for naming
        const imagesWithMetadata = data.perspectives.flatMap(p => {
            return [
                { image: p.mainImage, prompt: p.prompt, label: p.label },
                ...(p.extendedFrames || []).map(f => ({ image: f, prompt: p.prompt, label: `${p.label}-${f.label}` }))
            ];
        });

        for (let i = 0; i < imagesWithMetadata.length; i++) {
            const { image, prompt, label } = imagesWithMetadata[i];
            setStatusMessage(`Uploading image ${i + 1}/${imagesWithMetadata.length}: ${label}...`);
            const { src } = image;
            const mimeType = src.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/png';
            const extension = mimeType.split('/')[1];
            const base64Data = src.split(',')[1];
            const blob = base64ToBlob(base64Data, mimeType);
            
            // Optimized naming using prompt (Artistic Direction) if available
            let nameBase = label.replace(/\s+/g, '-');
            if (prompt && prompt.length > 5) {
                nameBase = prompt
                    .replace(/[^a-z0-9\s-]/gi, '')
                    .trim()
                    .replace(/\s+/g, '-')
                    .substring(0, 60)
                    .toLowerCase();
            }

            const filename = `${nameBase}.${extension}`;
            await uploadFile(campaignFolderId, blob, filename);
        }

        // Upload text content
        setStatusMessage('Uploading text content...');
        let textContent = `AI Generated Content for: ${campaignFolderName}\n\n`;
        
        textContent += `====================\n`;
        textContent += `PERSPECTIVE PROMPTS & VISUAL DIRECTION\n`;
        textContent += `====================\n\n`;
        data.perspectives.forEach((p, index) => {
            textContent += `Perspective ${index + 1}: ${p.label}\n`;
            textContent += `Image Prompt: ${p.prompt}\n`;
            if (p.veoPrompt) {
                textContent += `Veo Video Prompt: ${p.veoPrompt}\n`;
            }
            if (p.mainImage.description) {
                textContent += `Description (EN): ${p.mainImage.description.en}\n`;
                textContent += `Description (CN): ${p.mainImage.description.cn}\n`;
            }
            textContent += `\n`;
        });
        
        Object.entries(data.socialPosts).forEach(([platform, post]) => {
            textContent += `====================\n`;
            textContent += `${platform.toUpperCase()} POST\n`;
            textContent += `====================\n\n${post}\n\n\n`;
        });

        const textBlob = new Blob([textContent], { type: 'text/plain' });
        await uploadFile(campaignFolderId, textBlob, 'social-media-content.txt');
        
        setStatusMessage('Successfully saved to Google Drive!');
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during the Google Drive export.';
        setStatusMessage(`Error: ${errorMessage}`);
        throw new Error(errorMessage);
    }
};

export const saveVideoFromUrlToDrive = async (
    videoUrl: string, 
    filename: string,
    campaignFolderName: string, 
    setStatusMessage: (msg: string) => void
): Promise<void> => {
    try {
        setStatusMessage('Initializing Google services...');
        await initializeGoogleClients();

        setStatusMessage('Authenticating with Google Drive...');
        await handleAuthClick();

        setStatusMessage('Locating campaign folder in Google Drive...');
        const rootFolderId = await getOrCreateFolder('Content Catalyst Engine Exports');
        const campaignFolderId = await getOrCreateFolder(campaignFolderName, rootFolderId);

        setStatusMessage(`Downloading video from source...`);
        const videoResponse = await fetch(videoUrl);
        if (!videoResponse.ok) {
            const errorText = await videoResponse.text();
            throw new Error(`Failed to download video from the source URL. Status: ${videoResponse.status}. Details: ${errorText}`);
        }
        const videoBlob = await videoResponse.blob();

        setStatusMessage(`Uploading video to Google Drive...`);
        await uploadFile(campaignFolderId, videoBlob, filename);

        setStatusMessage('Video successfully saved to Google Drive!');
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred while saving the video to Google Drive.';
        setStatusMessage(`Error: ${errorMessage}`);
        throw new Error(errorMessage);
    }
};
