
import React, { useState, useEffect } from 'react';
import type { GeneratedData, SocialPosts, GeneratedPerspective, GeneratedImage } from '../types';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { InstagramIcon } from './icons/InstagramIcon';
import { TikTokIcon } from './icons/TikTokIcon';
import { FacebookIcon } from './icons/FacebookIcon';
import { YouTubeIcon } from './icons/YouTubeIcon';
import { PinterestIcon } from './icons/PinterestIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { ExportIcon } from './icons/ExportIcon';
import JSZip from 'jszip';
import jsPDF from 'jspdf';
import { XIcon } from './icons/XIcon';
import { BlogIcon } from './icons/BlogIcon';
import { VariationsIcon } from './icons/VariationsIcon';
import { ExtendFrameIcon } from './icons/ExtendFrameIcon';
import { ImagePreviewModal } from './ImagePreviewModal';
import { VariationsModal } from './VariationsModal';
import { RefreshIcon } from './icons/RefreshIcon';
import { EditIcon } from './icons/EditIcon';
import { RefineModal } from './RefineModal';
import { VideoIcon } from './icons/VideoIcon';
import { GoogleDriveIcon } from './icons/GoogleDriveIcon';
import { saveToDrive, isGoogleDriveConfigured } from '../services/googleDriveService';


interface ResultsDisplayProps {
  data: GeneratedData;
  onPerspectiveImageUpdate: (perspectiveId: string, newImage: GeneratedImage) => void;
  productName: string;
  campaignName: string;
  videoPrompt: string;
  onExpand: (prompt: string) => Promise<void>;
  isExpanding: boolean;
  onRegenerate: (perspectiveId: string) => Promise<void>;
  onExtendFrame: (perspectiveId: string) => Promise<void>;
  onClearPerspectiveError: (perspectiveId: string) => void;
}

const CopyButton: React.FC<{ textToCopy: string, className?: string }> = ({ textToCopy, className }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    
    const defaultClass = "absolute top-3 right-3 p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors";

    return (
        <button onClick={handleCopy} className={className || defaultClass} aria-label="Copy to clipboard">
            {copied ? <span className="text-xs text-lime-400 px-1">Copied!</span> : <ClipboardIcon />}
        </button>
    );
};

// Helper to sanitize filename from string
const sanitizeFilename = (text: string, fallback: string) => {
    if (!text || text.length < 5) return fallback;
    return text
        .replace(/[^a-z0-9\s-]/gi, '')
        .trim()
        .replace(/\s+/g, '-')
        .substring(0, 60)
        .toLowerCase();
};

const PerspectiveCard: React.FC<{
    perspective: GeneratedPerspective;
    campaignName: string;
    onImageClick: (src: string, id: string) => void;
    onVariationsClick: (image: GeneratedImage, id: string) => void;
    onRefineClick: (image: GeneratedImage, id: string) => void;
    onExtendFrame: (id: string) => void;
    onRegenerate: (id: string) => void;
    onClearError: (id: string) => void;
}> = ({ perspective, campaignName, onImageClick, onVariationsClick, onRefineClick, onExtendFrame, onRegenerate, onClearError }) => {
    
    const handleDownload = (src: string, filename: string) => {
        const link = document.createElement('a');
        const mimeType = src.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1];
        const extension = mimeType ? mimeType.split('/')[1] : 'png';
        const finalFilenameBase = campaignName && campaignName.trim() ? `${campaignName.trim()}-${filename}` : filename;
        link.href = src;
        link.download = `${finalFilenameBase}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const mainImageFilename = sanitizeFilename(perspective.prompt, perspective.label);

    return (
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-4 rounded-xl shadow-lg flex flex-col">
            <h3 className="text-lg font-bold text-white truncate mb-3">{perspective.label}</h3>
            
            <div className="flex-grow space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative aspect-square group">
                        {perspective.isRegenerating ? (
                            <div className="w-full h-full bg-slate-800 rounded-lg flex flex-col items-center justify-center animate-pulse">
                                <RefreshIcon className="h-8 w-8 text-slate-600 animate-spin" />
                                <span className="text-xs text-slate-500 mt-2">Regenerating...</span>
                            </div>
                        ) : (
                            <>
                               <img src={perspective.mainImage.src} alt={perspective.mainImage.description?.en || perspective.mainImage.label} className="w-full h-full object-cover rounded-lg shadow-md" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => onImageClick(perspective.mainImage.src, perspective.id)} className="text-white bg-slate-800/80 p-2 rounded-full hover:bg-slate-700" title="Zoom">Zoom</button>
                                    <button onClick={() => handleDownload(perspective.mainImage.src, mainImageFilename)} className="text-white bg-slate-800/80 p-2 rounded-full hover:bg-slate-700" title="Download Image">
                                        <DownloadIcon />
                                    </button>
                                </div>
                            </>
                        )}
                         <div className="absolute top-2 right-2 flex flex-col gap-2">
                            <button onClick={() => onRegenerate(perspective.id)} disabled={perspective.isRegenerating} className="p-2 bg-slate-900/70 rounded-full text-white hover:bg-lime-500/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Regenerate">
                                <RefreshIcon />
                            </button>
                            <button onClick={() => onVariationsClick(perspective.mainImage, perspective.id)} disabled={perspective.isRegenerating} className="p-2 bg-slate-900/70 rounded-full text-white hover:bg-lime-500/80 transition-colors disabled:opacity-50" title="Variations">
                                <VariationsIcon />
                            </button>
                             <button onClick={() => onRefineClick(perspective.mainImage, perspective.id)} disabled={perspective.isRegenerating} className="p-2 bg-slate-900/70 rounded-full text-white hover:bg-lime-500/80 transition-colors disabled:opacity-50" title="Edit/Refine">
                                <EditIcon />
                            </button>
                         </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-slate-300">For Video</h4>
                            <button onClick={() => onExtendFrame(perspective.id)} disabled={perspective.isExtending} className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded-md transition-colors disabled:opacity-50">
                                <ExtendFrameIcon /> {perspective.extendedFrames ? 'Re-Extend' : 'Extend Frame'}
                            </button>
                        </div>
                        {perspective.isExtending ? (
                             <div className="grid grid-cols-2 gap-2">
                                {[...Array(4)].map((_, i) => <div key={i} className="aspect-square bg-slate-800 rounded-lg animate-pulse" />)}
                             </div>
                        ) : perspective.extendedFrames ? (
                            <div className="grid grid-cols-2 gap-2">
                                {perspective.extendedFrames.map((frame, i) => {
                                    const frameFilename = sanitizeFilename(`${perspective.prompt}-extend-${i}`, `${perspective.label}-${frame.label}`);
                                    return (
                                    <div key={i} className="relative aspect-square group">
                                        <img src={frame.src} alt={frame.label} className="w-full h-full object-cover rounded-lg" />
                                        <div className="absolute bottom-1 right-1">
                                             <button onClick={() => handleDownload(frame.src, frameFilename)} className="p-1.5 bg-slate-900/60 rounded-full text-white hover:bg-lime-500/80 transition-colors opacity-0 group-hover:opacity-100" title="Download">
                                                <DownloadIcon />
                                            </button>
                                        </div>
                                        <div className="absolute top-0 left-0 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-br-md rounded-tl-lg">{frame.label}</div>
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="aspect-video bg-slate-800/50 border-2 border-dashed border-slate-700 rounded-lg flex items-center justify-center text-center p-2">
                                <p className="text-xs text-slate-500">Click "Extend Frame" to generate video assets</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-800/60 border border-fuchsia-500/30 p-3 rounded-lg relative mt-2">
                     <div className="flex items-center gap-2 mb-1 text-fuchsia-300 font-semibold text-xs uppercase tracking-wider">
                        <VideoIcon /> 
                        <span>Image-to-Video Prompt (Veo/Kling)</span>
                     </div>
                     <p className="text-xs text-slate-300 pr-10 leading-relaxed font-mono bg-slate-900/50 p-2 rounded">
                        {perspective.veoPrompt || "Detailed prompt not available for this image."}
                     </p>
                     <CopyButton textToCopy={perspective.veoPrompt || ""} className="absolute top-3 right-3 p-1.5 bg-slate-700/80 rounded-md hover:bg-fuchsia-600 transition-colors text-white" />
                </div>

                <div className="bg-slate-800/60 border border-lime-500/30 p-3 rounded-lg relative mt-2">
                     <div className="flex items-center gap-2 mb-1 text-lime-300 font-semibold text-xs uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span>Artistic Direction (Image Prompt)</span>
                     </div>
                     <p className="text-xs text-slate-300 pr-10 leading-relaxed font-mono bg-slate-900/50 p-2 rounded max-h-24 overflow-y-auto custom-scrollbar">
                        {perspective.prompt || "Prompt details unavailable."}
                     </p>
                     <CopyButton textToCopy={perspective.prompt || ""} className="absolute top-3 right-3 p-1.5 bg-slate-700/80 rounded-md hover:bg-lime-600 transition-colors text-white" />
                </div>
            </div>
        </div>
    );
};


export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ data, onPerspectiveImageUpdate, productName, campaignName, onExpand, isExpanding, onRegenerate, onExtendFrame, onClearPerspectiveError }) => {
    const { socialPosts, perspectives } = data;
    const [activeTab, setActiveTab] = useState('');
    const [expansionPrompt, setExpansionPrompt] = useState('');
    
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isVariationsOpen, setIsVariationsOpen] = useState(false);
    const [isRefineOpen, setIsRefineOpen] = useState(false);
    const [activeImage, setActiveImage] = useState<{image: GeneratedImage, id: string} | null>(null);

    const [isSavingToDrive, setIsSavingToDrive] = useState(false);
    const [driveStatus, setDriveStatus] = useState('');

    const driveConfigured = isGoogleDriveConfigured();

    const allSocialPlatforms = [
        { name: 'Instagram', icon: <InstagramIcon />, contentKey: 'instagram' },
        { name: 'Facebook', icon: <FacebookIcon />, contentKey: 'facebook' },
        { name: 'TikTok', icon: <TikTokIcon />, contentKey: 'tiktok' },
        { name: 'YouTube', icon: <YouTubeIcon />, contentKey: 'youtube' },
        { name: 'Pinterest', icon: <PinterestIcon />, contentKey: 'pinterest' },
        { name: 'X', icon: <XIcon />, contentKey: 'x' },
        { name: 'Blog', icon: <BlogIcon />, contentKey: 'blog' },
    ];
    
    const availableSocialPlatforms = allSocialPlatforms.filter(p => socialPosts[p.contentKey as keyof SocialPosts]);

    useEffect(() => {
        if (availableSocialPlatforms.length > 0 && !activeTab) {
            setActiveTab(availableSocialPlatforms[0].name);
        }
    }, [socialPosts]);

    const handleImageClick = (src: string, id: string) => {
        setActiveImage({ image: { src, label: ''}, id });
        setIsPreviewOpen(true);
    };
    
    const handleVariationsClick = (image: GeneratedImage, id: string) => {
        setActiveImage({ image, id });
        setIsVariationsOpen(true);
    };
    
    const handleRefineClick = (image: GeneratedImage, id: string) => {
        setActiveImage({ image, id });
        setIsRefineOpen(true);
    };

    const handleReplaceImage = (newImage: GeneratedImage) => {
        if (activeImage !== null) {
            onPerspectiveImageUpdate(activeImage.id, newImage);
        }
    };
    
    const handleExpandClick = async () => {
        await onExpand(expansionPrompt);
        setExpansionPrompt('');
    };
    
    const handleExportImages = async () => {
        const zip = new JSZip();
        for (const p of perspectives) {
            const { mainImage } = p;
            
            // Use prompt for filename
            const filename = sanitizeFilename(p.prompt, mainImage.label);
            const finalFilenameBase = campaignName && campaignName.trim() ? `${campaignName.trim()}-${filename}` : filename;
            
            const mimeType = mainImage.src.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1];
            const extension = mimeType ? mimeType.split('/')[1] : 'png';
            const base64Data = mainImage.src.split(',')[1];
            zip.file(`${finalFilenameBase}.${extension}`, base64Data, { base64: true });
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${campaignName || 'generated'}-images.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportText = () => {
        const doc = new jsPDF();
        let y = 20;
        const margin = 20;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - (margin * 2);
        const pageHeight = doc.internal.pageSize.getHeight();

        const checkPageBreak = (heightNeeded: number) => {
            if (y + heightNeeded > pageHeight - margin) {
                doc.addPage();
                y = margin;
                return true;
            }
            return false;
        };

        const addText = (text: string, fontSize: number = 10, isBold: boolean = false, color: [number, number, number] = [0, 0, 0]) => {
            doc.setFontSize(fontSize);
            doc.setTextColor(color[0], color[1], color[2]);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            const lines = doc.splitTextToSize(text, contentWidth);
            const heightNeeded = lines.length * (fontSize * 0.5);
            checkPageBreak(heightNeeded);
            doc.text(lines, margin, y);
            y += heightNeeded + 5;
        };

        const addHorizontalLine = () => {
            checkPageBreak(5);
            doc.setDrawColor(200, 200, 200);
            doc.line(margin, y, pageWidth - margin, y);
            y += 10;
        };

        // Title
        addText(`CAMPAIGN REPORT: ${campaignName || 'AI Content'}`, 18, true, [0, 100, 0]);
        addText(`Generated on: ${new Date().toLocaleString()}`, 8, false, [100, 100, 100]);
        y += 10;

        if (productName) {
            addText(`Product: ${productName}`, 14, true);
            y += 5;
        }

        // Social Posts Section
        if (Object.keys(socialPosts).length > 0) {
            addHorizontalLine();
            addText('SOCIAL MEDIA DISTRIBUTION COPY', 14, true, [0, 100, 200]);
            y += 5;

            Object.entries(socialPosts).forEach(([platform, post]) => {
                if (post) {
                    addText(`${platform.toUpperCase()}`, 11, true, [50, 50, 50]);
                    addText(post as string, 10, false);
                    y += 5;
                }
            });
        }

        // Visual Deck Prompts Section
        if (perspectives.length > 0) {
            addHorizontalLine();
            addText('VISUAL DECK & ARTISTIC DIRECTION', 14, true, [150, 0, 150]);
            y += 5;

            perspectives.forEach((p, index) => {
                addText(`Shot ${index + 1}: ${p.label}`, 11, true);
                addText(`Visual Prompt: ${p.prompt}`, 9, false, [80, 80, 80]);
                if (p.veoPrompt) {
                    addText(`Video Direction: ${p.veoPrompt}`, 9, false, [0, 100, 100]);
                }
                y += 5;
            });
        }

        doc.save(`${campaignName || 'generated'}-content-report.pdf`);
    };

    const handleCopyAllPosts = () => {
        let allContent = `Campaign: ${campaignName || 'AI Content'}\n`;
        if (productName) allContent += `Product: ${productName}\n`;
        allContent += `\n--- SOCIAL MEDIA POSTS ---\n\n`;

        Object.entries(socialPosts).forEach(([platform, post]) => {
            if (post) {
                allContent += `[${platform.toUpperCase()}]\n${post}\n\n`;
            }
        });

        navigator.clipboard.writeText(allContent);
        alert('All social posts copied to clipboard!');
    };

    const handleSaveToDrive = async () => {
        setIsSavingToDrive(true);
        setDriveStatus('Initializing...');
        try {
            await saveToDrive(data, campaignName || `Campaign ${new Date().toLocaleDateString()}`, setDriveStatus);
            setDriveStatus('Saved!');
            setTimeout(() => {
                setIsSavingToDrive(false);
                setDriveStatus('');
            }, 3000);
        } catch (e) {
            console.error(e);
            const errorMsg = e instanceof Error ? e.message : 'Failed to save';
            setDriveStatus('Failed');
            alert(`Error saving to Google Drive: ${errorMsg}`);
            setTimeout(() => {
                setIsSavingToDrive(false);
                setDriveStatus('');
            }, 3000);
        }
    };
    
    const activeSocialPost = socialPosts[activeTab.toLowerCase() as keyof SocialPosts] || '';

    return (
        <div className="space-y-8 animate-fade-in">
            {activeImage && (
                <>
                    <ImagePreviewModal 
                        isOpen={isPreviewOpen}
                        onClose={() => setIsPreviewOpen(false)}
                        imageSrc={activeImage.image.src}
                    />
                    <VariationsModal
                        isOpen={isVariationsOpen}
                        onClose={() => setIsVariationsOpen(false)}
                        originalImage={activeImage.image}
                        onReplace={handleReplaceImage}
                    />
                    <RefineModal
                        isOpen={isRefineOpen}
                        onClose={() => setIsRefineOpen(false)}
                        originalImage={activeImage.image}
                        onSave={handleReplaceImage}
                    />
                </>
            )}
            
            {/* Export Section */}
            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm">
                 <h2 className="text-2xl font-monument mb-4 text-white uppercase tracking-tight">Export Suite</h2>
                 <div className="flex flex-wrap gap-4 items-center">
                     <button onClick={handleExportImages} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-5 rounded-lg transition-all border border-slate-600 shadow-sm hover:scale-[1.02]">
                        <ExportIcon />
                        Export Images (.zip)
                    </button>
                    <button onClick={handleExportText} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 px-5 rounded-lg transition-all border border-slate-600 shadow-sm hover:scale-[1.02]">
                        <ExportIcon />
                        Export PDF
                    </button>
                    <button 
                        onClick={handleSaveToDrive} 
                        disabled={isSavingToDrive || !driveConfigured}
                        title={driveConfigured ? "Save to Google Drive" : "Google Drive API Key or Client ID not configured"}
                        className={`flex items-center gap-2 font-semibold py-2.5 px-5 rounded-lg transition-all border shadow-sm hover:scale-[1.02] ${
                            isSavingToDrive 
                            ? 'bg-blue-900/50 border-blue-500/50 text-blue-200 cursor-wait' 
                            : !driveConfigured 
                                ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60'
                                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-600'
                        }`}
                    >
                        {isSavingToDrive ? (
                            <>
                                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm">{driveStatus || 'Saving...'}</span>
                            </>
                        ) : (
                            <>
                                <GoogleDriveIcon />
                                Save to Drive
                            </>
                        )}
                    </button>
                 </div>
            </div>

            {/* Generated Images */}
            <div>
                <h2 className="text-2xl font-monument mb-6 text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-lime-400"></div>
                    Visual Deck
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {perspectives?.map((p) => (
                         <PerspectiveCard 
                            key={p.id}
                            perspective={p}
                            campaignName={campaignName}
                            onImageClick={handleImageClick}
                            onVariationsClick={handleVariationsClick}
                            onRefineClick={handleRefineClick}
                            onExtendFrame={onExtendFrame}
                            onRegenerate={onRegenerate}
                            onClearError={onClearPerspectiveError}
                         />
                    ))}
                </div>
            </div>
            
            {/* Expand Results Section */}
            <div className="border-t border-slate-700 pt-8">
                 <h2 className="text-2xl font-monument mb-6 text-white uppercase tracking-tight flex items-center gap-3">
                    <div className="w-1.5 h-8 bg-indigo-500"></div>
                    Append Visuals
                 </h2>
                 <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700/50 backdrop-blur-sm space-y-4">
                    <textarea 
                        value={expansionPrompt}
                        onChange={(e) => setExpansionPrompt(e.target.value)}
                        rows={2} 
                        placeholder="Describe additional shots or story points to add to your collection..." 
                        className="block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg shadow-sm py-3 px-4 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all"
                        disabled={isExpanding}
                    />
                    <div className="flex justify-end">
                        <button 
                            onClick={handleExpandClick} 
                            disabled={isExpanding || !expansionPrompt.trim()} 
                            className="bg-indigo-600 text-white font-bold py-2.5 px-8 rounded-lg shadow-lg hover:bg-indigo-500 transition-all disabled:bg-slate-800 disabled:text-slate-500 flex items-center gap-2"
                          >
                            {isExpanding ? <RefreshIcon className="w-4 h-4 animate-spin"/> : '✨ Expand Deck'}
                         </button>
                    </div>
                 </div>
            </div>

            {/* Social Media Content */}
            {availableSocialPlatforms.length > 0 && (
                 <div className="animate-fade-in">
                    <div className="flex justify-between items-end mb-6">
                        <h2 className="text-2xl font-monument text-white uppercase tracking-tight flex items-center gap-3">
                            <div className="w-1.5 h-8 bg-cyan-500"></div>
                            Copy Distribution
                        </h2>
                        <button 
                            onClick={handleCopyAllPosts}
                            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-800/50 transition-all"
                        >
                            <ClipboardIcon className="w-3.5 h-3.5" />
                            Copy All Posts
                        </button>
                    </div>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
                        <div className="bg-slate-800/50 border-b border-slate-700">
                            <nav className="flex overflow-x-auto no-scrollbar" aria-label="Tabs">
                                {availableSocialPlatforms.map((platform) => (
                                    <button
                                        key={platform.name}
                                        onClick={() => setActiveTab(platform.name)}
                                        className={`flex-shrink-0 px-6 py-4 text-center border-b-2 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-200 ${
                                            activeTab === platform.name
                                            ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                                            : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                        }`}
                                    >
                                        {platform.icon}
                                        <span>{platform.name}</span>
                                    </button>
                                ))}
                            </nav>
                        </div>
                        <div className="relative p-8 min-h-[220px] bg-slate-950/50">
                            <div className="prose prose-invert max-w-none">
                                <p className="text-slate-300 whitespace-pre-wrap font-light leading-relaxed text-lg italic pr-12">
                                    {activeSocialPost}
                                </p>
                            </div>
                            <CopyButton textToCopy={activeSocialPost} className="absolute top-6 right-6 p-2.5 bg-slate-800 rounded-xl hover:bg-cyan-600 transition-all text-white border border-slate-700" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
