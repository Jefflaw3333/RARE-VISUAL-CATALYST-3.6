import React, { useState, useCallback, useRef, MouseEvent, useEffect } from 'react';
import { ResultsDisplay } from './components/ResultsDisplay';
import { Loader } from './components/Loader';
import { generateContentFromImage, generateMoreImages, generateSingleImage, extendFrameForVideo, generateBrainstormAngles, analyzeImage } from './services/geminiService';
import type { GeneratedData, FocusArea, GeneratedImage, GeneratedPerspective, ProductInfo, Preset, VideoPromptConfig } from './types';
import { InstagramIcon } from './components/icons/InstagramIcon';
import { FacebookIcon } from './components/icons/FacebookIcon';
import { TikTokIcon } from './components/icons/TikTokIcon';
import { YouTubeIcon } from './components/icons/YouTubeIcon';
import { PinterestIcon } from './components/icons/PinterestIcon';
import { XIcon } from './components/icons/XIcon';
import { BlogIcon } from './components/icons/BlogIcon';
import { AnalysisModal } from './components/AnalysisModal';
import { VideoIcon } from './components/icons/VideoIcon';
import Orb from './components/Orb';

// Utility function to crop an image from a base64 string
const cropImage = (imageBase64: string, pixelCrop: FocusArea): Promise<string> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageBase64;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = (error) => reject(error);
  });
};

// --- Icons ---
const MaximizeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v4m0 0h-4m4 0l-5-5" />
    </svg>
);

const ZoomInIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
         <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
    </svg>
);

const ZoomOutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
    </svg>
);


// --- Improved FocusableImage Component with Granular Zoom ---
interface FocusableImageProps {
    src: string;
    focusArea: FocusArea | null;
    onChange: (area: FocusArea | null) => void;
}

const FocusableImage: React.FC<FocusableImageProps> = ({ src, focusArea, onChange }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [zoom, setZoom] = useState(1);
    const imageRef = useRef<HTMLImageElement>(null);
    
    // Selection State
    const [isSelecting, setIsSelecting] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{x: number, y: number} | null>(null);
    const [dragRect, setDragRect] = useState<FocusArea | null>(null);

    // Handlers for Mouse Interaction
    const getRelativeCoords = (e: MouseEvent | globalThis.MouseEvent, element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        // If the image is zoomed, the rect.width is the SCALED width.
        // e.clientX is screen relative.
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = (e: MouseEvent<HTMLImageElement>) => {
        if (!imageRef.current) return;
        e.preventDefault();
        setIsSelecting(true);
        const coords = getRelativeCoords(e, imageRef.current);
        setSelectionStart(coords);
        setDragRect({ ...coords, width: 0, height: 0 });
    };

    useEffect(() => {
        const handleGlobalMouseMove = (e: globalThis.MouseEvent) => {
            if (!isSelecting || !selectionStart || !imageRef.current) return;
            
            const coords = getRelativeCoords(e, imageRef.current);
            const rect = imageRef.current.getBoundingClientRect();
            
            const x = Math.min(selectionStart.x, coords.x);
            const y = Math.min(selectionStart.y, coords.y);
            const width = Math.abs(coords.x - selectionStart.x);
            const height = Math.abs(coords.y - selectionStart.y);

            // Boundary checks
            const boundedX = Math.max(0, Math.min(x, rect.width));
            const boundedY = Math.max(0, Math.min(y, rect.height));
            const boundedWidth = Math.min(width, rect.width - boundedX);
            const boundedHeight = Math.min(height, rect.height - boundedY);

            setDragRect({ x: boundedX, y: boundedY, width: boundedWidth, height: boundedHeight });
        };

        const handleGlobalMouseUp = () => {
            if (!isSelecting || !imageRef.current) return;
            
            setIsSelecting(false);
            
            if (dragRect && dragRect.width > 10 && dragRect.height > 10) {
                const img = imageRef.current;
                const rect = img.getBoundingClientRect();
                
                const scaleX = img.naturalWidth / rect.width;
                const scaleY = img.naturalHeight / rect.height;

                const naturalArea = {
                    x: Math.round(dragRect.x * scaleX),
                    y: Math.round(dragRect.y * scaleY),
                    width: Math.round(dragRect.width * scaleX),
                    height: Math.round(dragRect.height * scaleY),
                };
                onChange(naturalArea);
            } else if (dragRect && dragRect.width < 10) {
                onChange(null); // Click to clear
            }
            
            setDragRect(null);
            setSelectionStart(null);
        };

        if (isSelecting) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isSelecting, selectionStart, dragRect, onChange]);

    // Helper to calculate visual rect from props
    const getVisualRect = () => {
        if (!focusArea || !imageRef.current) return null;
        const img = imageRef.current;
        const rect = img.getBoundingClientRect();
        const scaleX = rect.width / img.naturalWidth;
        const scaleY = rect.height / img.naturalHeight;

        return {
            x: focusArea.x * scaleX,
            y: focusArea.y * scaleY,
            width: focusArea.width * scaleX,
            height: focusArea.height * scaleY
        };
    };

    // We need to force a re-render when the image loads/resizes to update the visual rect
    const [_, setTick] = useState(0);
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => setTick(t => t + 1));
        if (imageRef.current) resizeObserver.observe(imageRef.current);
        return () => resizeObserver.disconnect();
    }, []);


    const visualSelection = isSelecting ? dragRect : getVisualRect();

    // -- Render Content --
    const renderImageContent = (inModal: boolean) => (
        <div 
            className={`relative inline-block select-none ${inModal ? '' : 'w-full h-full'}`}
            style={inModal ? { width: `${zoom * 100}%` } : {}}
        >
            <img
                ref={imageRef}
                src={src}
                alt="Focus Subject"
                draggable={false}
                onMouseDown={handleMouseDown}
                onLoad={() => setTick(t => t + 1)}
                className={`block ${inModal ? 'w-full h-auto' : 'w-full h-full object-contain bg-slate-900'}`}
                style={{ cursor: 'crosshair' }}
            />
            {visualSelection && (
                 <>
                    {/* Dim overlay outside selection */}
                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: 0, left: 0, width: '100%', height: visualSelection.y }} />
                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: visualSelection.y + visualSelection.height, left: 0, width: '100%', bottom: 0 }} />
                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: visualSelection.y, left: 0, width: visualSelection.x, height: visualSelection.height }} />
                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: visualSelection.y, left: visualSelection.x + visualSelection.width, right: 0, height: visualSelection.height }} />

                    {/* Selection Box */}
                    <div
                        className="absolute border-2 border-lime-400 pointer-events-none shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                        style={{
                            left: visualSelection.x,
                            top: visualSelection.y,
                            width: visualSelection.width,
                            height: visualSelection.height,
                        }}
                    >
                        {/* Corner Handles decoration */}
                         <div className="absolute -top-1 -left-1 w-2 h-2 bg-lime-400 border border-black" />
                         <div className="absolute -top-1 -right-1 w-2 h-2 bg-lime-400 border border-black" />
                         <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-lime-400 border border-black" />
                         <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-lime-400 border border-black" />
                    </div>
                </>
            )}
        </div>
    );

    return (
        <>
            {/* Thumbnail View */}
            <div className="relative w-full h-full group bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
                {renderImageContent(false)}
                
                <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={() => setIsExpanded(true)}
                        className="p-1.5 bg-slate-900/80 text-white rounded-md hover:bg-lime-600 transition-colors shadow-lg border border-slate-600"
                        title="Precision Focus (Expand)"
                    >
                        <MaximizeIcon />
                    </button>
                </div>
                {focusArea && (
                    <div className="absolute bottom-2 left-2 bg-lime-900/80 text-lime-100 text-xs px-2 py-1 rounded backdrop-blur-sm border border-lime-500/30 pointer-events-none">
                        Focus Set
                    </div>
                )}
            </div>

            {/* Expanded Modal View */}
            {isExpanded && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex flex-col animate-fade-in">
                    {/* Toolbar */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
                        <div className="flex items-center gap-4">
                            <h3 className="text-white font-semibold text-lg">Precision Focus Selection</h3>
                            <div className="flex items-center gap-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
                                <button onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} className="p-1 hover:bg-slate-700 text-slate-300 rounded"><ZoomOutIcon /></button>
                                <span className="text-xs font-mono text-lime-400 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(Math.min(4, zoom + 0.25))} className="p-1 hover:bg-slate-700 text-slate-300 rounded"><ZoomInIcon /></button>
                            </div>
                            <input 
                                type="range" 
                                min="0.5" 
                                max="4" 
                                step="0.1" 
                                value={zoom} 
                                onChange={(e) => setZoom(parseFloat(e.target.value))}
                                className="w-32 accent-lime-500" 
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => onChange(null)} className="px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
                                Clear Focus
                            </button>
                            <button 
                                onClick={() => setIsExpanded(false)} 
                                className="px-4 py-1.5 bg-lime-600 hover:bg-lime-500 text-white font-bold rounded transition-colors shadow-lg shadow-lime-900/20"
                            >
                                Done
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Canvas */}
                    <div className="flex-1 overflow-auto flex items-center justify-center p-8 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMWgydjJIMUMxeiIgZmlsbD0iIzMzMyIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3N2Zz4=')]">
                        <div className={`relative shadow-2xl border-2 border-slate-700 ${zoom < 1 ? '' : ''}`}>
                            {renderImageContent(true)}
                        </div>
                    </div>
                     <div className="bg-slate-900 p-2 text-center text-xs text-slate-500 border-t border-slate-800">
                        Use the zoom controls to get closer. Drag on the image to set focus.
                    </div>
                </div>
            )}
        </>
    );
};

interface TagButtonProps {
    onClick: () => void;
    isSelected: boolean;
    children: React.ReactNode;
}

const TagButton: React.FC<TagButtonProps> = ({ onClick, isSelected, children }) => (
    <button
        onClick={onClick}
        className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all duration-200 flex items-start gap-2 ${
            isSelected 
            ? 'bg-lime-900/50 border-lime-400 text-lime-300 ring-2 ring-lime-400/50 shadow-lg' 
            : 'bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-700/80 hover:border-slate-500'
        }`}
    >
        {children}
    </button>
);

const CollapsibleSection: React.FC<{ title: React.ReactNode; isOpen: boolean; onToggle: () => void; children: React.ReactNode; titleClassName?: string }> = ({ title, isOpen, onToggle, children, titleClassName }) => (
    <div className="border-t border-slate-700">
        <button onClick={onToggle} className="w-full flex justify-between items-center py-3 font-semibold text-slate-200">
            <span className={titleClassName}>{title}</span>
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </button>
        {isOpen && <div className="pb-4 space-y-4">{children}</div>}
    </div>
);

const BilingualLabel: React.FC<{ text: string }> = ({ text }) => {
    const match = text.match(/^(.*?)\s*\((.*?)\)\s*(.*)$/);
    if (match) {
        const [, english, chinese, emoji] = match;
        return (
            <div>
                <span className="font-semibold block text-lime-300">{`${english.trim()} ${emoji.trim()}`.trim()}</span>
                <span className="text-xs text-slate-400 block font-normal">{chinese.trim()}</span>
            </div>
        );
    }
    return <span className="font-semibold">{text}</span>;
};

const BilingualTitle: React.FC<{ text: string }> = ({ text }) => {
    const match = text.match(/^(.*?)\s*\((.*?)\)\s*$/);
    if (match) {
        const [, english, chinese] = match;
        return (
            <>
                <span className="font-semibold block text-lime-300">{english.trim()}</span>
                <span className="text-xs text-slate-400 block font-normal -mt-1">{chinese.trim()}</span>
            </>
        );
    }
    return <span className="font-semibold block text-lime-300">{text}</span>;
};

// Increased from 6 to 32
const MAX_TOTAL_IMAGES = 32;

const App: React.FC = () => {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [focusArea, setFocusArea] = useState<FocusArea | null>(null);
  const [campaignName, setCampaignName] = useState<string>('');
  const [productName, setProductName] = useState<string>('');
  const [sellingPoints, setSellingPoints] = useState<string>('');
  const [productLink, setProductLink] = useState<string>('');
  const [generationDescription, setGenerationDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isBrainstorming, setIsBrainstorming] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Selection States
  const [selectedAngles, setSelectedAngles] = useState<string[]>([]);
  const [selectedProductStudioAngles, setSelectedProductStudioAngles] = useState<string[]>([]);
  const [customAngles, setCustomAngles] = useState<string[]>([]);
  const [selectedFocusSubjects, setSelectedFocusSubjects] = useState<string[]>([]); // New State for Focus Subjects
  
  const [currentCustomAngle, setCurrentCustomAngle] = useState<string>('');
  const [generateMultiPerson, setGenerateMultiPerson] = useState<boolean>(false);
  const [generateScene, setGenerateScene] = useState<boolean>(false);
  const [generateSocialCopy, setGenerateSocialCopy] = useState<boolean>(false);
  
  // Creative Controls States
  const [creativityBoost, setCreativityBoost] = useState<boolean>(false);
  const [consistencyMode, setConsistencyMode] = useState<boolean>(false);
  const [sensualMode, setSensualMode] = useState<boolean>(false); 
  const [ugcMode, setUgcMode] = useState<boolean>(false); // NEW STATE for Lo-Fi/UGC Authenticity
  const [targetRegion, setTargetRegion] = useState<string>(''); // New State
  const [targetAudience, setTargetAudience] = useState<string>(''); // New State

  const [isExpanding, setIsExpanding] = useState<boolean>(false);
  const [openAccordion, setOpenAccordion] = useState('perspectives');
  const [openCreativeSubAccordion, setOpenCreativeSubAccordion] = useState<string>('');
  
  // Video Director State
  const [videoPromptConfig, setVideoPromptConfig] = useState<VideoPromptConfig>({
    scene: '',
    action: '',
    style: '',
    cameraMovement: 'Static',
    composition: '',
    atmosphere: '',
  });

  // Dimensions State
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [customWidth, setCustomWidth] = useState<number>(1024);
  const [customHeight, setCustomHeight] = useState<number>(1024);
  
  // Quantity State
  const [imagesPerAngle, setImagesPerAngle] = useState<number>(1);

  // API Key Gate State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);

  // Analysis Modal State
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [analysisText, setAnalysisText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [lifestyleScene, setLifestyleScene] = useState({
    scene: [] as string[],
    props: [] as string[],
    atmosphere: [] as string[],
    audience: [] as string[],
    closeUpDetails: [] as string[],
  });
  const [customLifestyle, setCustomLifestyle] = useState({
    props: '',
    atmosphere: '',
    audience: '',
  });
  const [selectedSocialStrategies, setSelectedSocialStrategies] = useState<string[]>([]);
  const [selectedSocialPlatforms, setSelectedSocialPlatforms] = useState<string[]>(['Instagram', 'Facebook', 'TikTok']);
  const [selectedStyleFilter, setSelectedStyleFilter] = useState<string>('');
  const [presets, setPresets] = useState<Preset[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceFileInputRef = useRef<HTMLInputElement>(null);

  // Check for API Key on mount
  useEffect(() => {
    const checkApiKey = async () => {
        if ((window as any).aistudio && (window as any).aistudio.hasSelectedApiKey) {
            const hasKey = await (window as any).aistudio.hasSelectedApiKey();
            setHasApiKey(hasKey);
        } else {
            // Fallback for environments without the helper
            setHasApiKey(true);
        }
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    try {
      const savedPresets = localStorage.getItem('contentCatalystPresets');
      if (savedPresets) {
        const parsed = JSON.parse(savedPresets);
        if (Array.isArray(parsed)) {
            setPresets(parsed);
        } else {
            setPresets([]);
        }
      }
    } catch (e) {
      console.error("Failed to load presets from localStorage", e);
      localStorage.removeItem('contentCatalystPresets');
    }
  }, []);

  const shotAndAngleOptions = [
    { id: 'extremeWideShot', label: 'Extreme Wide Shot (极广角/大远景) 🏔️' },
    { id: 'farView', label: 'Wide / Far View (远景) 🏞️' },
    { id: 'midView', label: 'Mid View (中景) 👤' },
    { id: 'mediumCloseUp', label: 'Medium Close-up (中特写) 👱' },
    { id: 'closeUp', label: 'Close-up (特写) 🔍' },
    { id: 'pov', label: 'Point of View (POV) (第一人称) 👀' },
    { id: 'heroShot', label: 'Hero Shot (英雄主图) 🏆' },
    { id: 'knolling', label: 'Knolling / Flat Lay (整齐平铺) 📏' },
    { id: 'dutchAngle', label: 'Dutch Angle (倾斜构图) 📐' },
    { id: 'overShoulder', label: 'Over-the-Shoulder (过肩视角) 👥' },
    { id: 'birdsEyeView', label: 'Bird\'s Eye View (上帝视角) 🦅' },
    { id: 'wormsEyeView', label: 'Worm\'s Eye View (虫视视角) 🐛' },
    { id: 'trackingShot', label: 'Tracking Shot (动态跟随) 🏃' },
    { id: 'lowAngle', label: 'Low-Angle (低角度) 🐜' },
  ];

  const focusSubjects = [
    { id: 'fullBody', label: 'Full Body (全身) 🧍' },
    { id: 'hand', label: 'Hand (手) ✋' },
    { id: 'fingers', label: 'Fingers (手指) 🤏' },
    { id: 'feet', label: 'Feet (脚) 🦶' },
    { id: 'upperBody', label: 'Upper Body (上半身) 👕' },
    { id: 'lowerBody', label: 'Lower Body (下半身) 👖' },
  ];
  
  const productStudioAngles = [
    { id: 'product_frontView', label: 'Front View (正面平视)' },
    { id: 'product_threeQuarterLeft', label: 'Three-Quarter Left (左侧3/4视图)' },
    { id: 'product_threeQuarterRight', label: 'Three-Quarter Right (右侧3/4视图)' },
    { id: 'product_profileLeft', label: 'Profile Left (左侧面)' },
    { id: 'product_topDown', label: 'Top-Down / Flat Lay (俯拍/平铺)' },
    { id: 'product_macroShot', label: 'Detailed Macro (细节微距)' },
];

  const cameraMovements = [
    "Static (静态)", "Dolly In (推近)", "Dolly Out (拉远)", "Pan Left (左移)", "Pan Right (左移)", 
    "Tilt Up (上仰)", "Tilt Down (下俯)", "Crane Up (垂直上升)", "Crane Down (垂直下降)", 
    "Handheld (手持)", "Orbital (环绕)", "Tracking (追踪)", "Zoom In (变焦推)", "Zoom Out (变焦拉)", "360 Spin (360旋转)"
  ];

  const videoStyles = [
    "Cinematic (电影感)", "Animation (动画)", "Stop-motion (定格动画)", "Documentary (纪录片)", 
    "Vintage Film (复古胶片)", "Hyper-realistic (超现实)", "Sci-Fi (科幻)", "Minimalist (极简)"
  ];

  const videoActionPresets = [
    { id: 'hair_blowing', label: 'Hair Blowing (发丝微动) 💨' },
    { id: 'gentle_breathing', label: 'Gentle Breathing (呼吸感) 🫁' },
    { id: 'eye_blink', label: 'Soft Blink (温柔眨眼) 👁️' },
    { id: 'liquid_ripples', label: 'Liquid Ripples (液体涟漪) 💧' },
    { id: 'dust_motes', label: 'Floating Dust (漂浮微尘) ✨' },
    { id: 'shimmering_light', label: 'Shimmering Light (波光粼粼) 🌊' },
    { id: 'leaves_rustling', label: 'Leaves Rustling (叶片摇曳) 🌿' },
    { id: 'slow_rotation', label: 'Product Rotation (缓慢旋转) 🔄' },
    { id: 'steam_rising', label: 'Steam Rising (蒸汽升腾) ♨️' },
    { id: 'lens_flare', label: 'Lens Flare (炫光移动) ☀️' },
    { id: 'clothes_swaying', label: 'Clothes Swaying (衣物摆动) 👕' },
    { id: 'raindrops', label: 'Raindrops Falling (雨滴落下) 🌧️' },
    { id: 'snow_fluttering', label: 'Snow Fluttering (雪花飘落) ❄️' },
    { id: 'bokeh_shifting', label: 'Bokeh Shifting (虚化偏移) 📷' },
    { id: 'shadow_movement', label: 'Shadow Movement (光影移动) 👤' },
  ];

  const videoScenePresets = [
    { id: 'cyberpunk', label: 'Cyberpunk Neon (赛博霓虹) 🌃' },
    { id: 'mediterranean', label: 'Mediterranean (阳光地中海) 🏖️' },
    { id: 'white_studio', label: 'Minimalist Studio (极简白棚) 📸' },
    { id: 'rainforest', label: 'Tropical Forest (热带雨林) 🌴' },
    { id: 'marble_luxury', label: 'Luxury Marble (大理石室内) 🏛️' },
    { id: 'golden_hour', label: 'Golden Hour Beach (落日沙滩) 膨' },
    { id: 'misty_morning', label: 'Misty Morning (迷雾晨森) 🌫️' },
    { id: 'hitech_lab', label: 'High-Tech Lab (科技实验室) 🧪' },
    { id: 'autumn_cabin', label: 'Autumn Cabin (温馨秋木屋) 🍂' },
    { id: 'space_station', label: 'Space Station (太空站) 🚀' },
    { id: 'vintage_diner', label: '50s Diner (复古餐厅) 🍔' },
    { id: 'zen_garden', label: 'Zen Garden (禅意沙庭) 🎋' },
    { id: 'warehouse', label: 'Industrial Warehouse (工业仓库) 🏭' },
    { id: 'cloudscape', label: 'Dreamy Cloudscape (梦幻云海) ☁️' },
    { id: 'french_balcony', label: 'French Balcony (法式阳台) 🇫🇷' },
  ];

  const lifestyleOptions = {
      scene: [
        { id: 'Coffee Shop Table', label: 'Coffee Shop Table (咖啡厅桌面) ☕' },
        { id: 'Street Style / Outdoor', label: 'Street Style / Outdoor (街拍/户外) 🛣️' },
        { id: 'Dressing Table / Vanity', label: 'Dressing Table / Vanity (梳妆台) 💄' },
        { id: 'Gift Box / Packaging', label: 'Gift Box / Packaging (礼盒/包装) 🎁' },
        { id: 'Living Room / Sofa', label: 'Living Room / Sofa (客厅/沙发) 🛋️' },
        { id: 'Bedroom / Bedside Table', label: 'Bedroom / Bedside (卧室/床头柜) 🛏️' },
        { id: 'Office Desk', label: 'Office Desk (办公桌) 💻' },
        { id: 'Travel / Airport', label: 'Travel / Airport (旅行/机场) ✈️' },
        { id: 'Event / Party', label: 'Event / Party (活动/派对) 🎉' },
      ],
      props: [
        { id: 'Hand + Bag', label: 'Hand + Bag (手+包包) ✋👜' },
        { id: 'Coffee Cup', label: 'Coffee Cup (咖啡杯) ☕' },
        { id: 'Flowers', label: 'Flowers (鲜花) 🌸' },
        { id: 'Gift Box', label: 'Gift Box (礼盒) 🎁' },
        { id: 'Book / Notebook', label: 'Book / Notebook (书/笔记本) 📖' },
        { id: 'Laptop / Phone', label: 'Laptop / Phone (电脑/手机) 📱' },
        { id: 'Candle / Jewelry Tray', label: 'Candle / Jewelry Tray (蜡烛/首饰盘) 🕯️' },
        { id: 'Food / Dessert', label: 'Food / Dessert (食物/甜点) 🍰' },
        { id: 'Holiday Decor', label: 'Holiday Decor (节日装饰) 🎄' },
      ],
      atmosphere: [
        { id: 'Cozy / Warm', label: 'Cozy / Warm (温馨) 🌿' },
        { id: 'Exquisite / Premium', label: 'Exquisite / Premium (精致/高级) ✨' },
        { id: 'Playful', label: 'Playful (俏皮) 😋' },
        { id: 'Festive', label: 'Festive (节日感) 🎉' },
        { id: 'Minimalist', label: 'Minimalist (极简) 🖤' },
        { id: 'Relaxed / Casual', label: 'Relaxed / Casual (放松/休闲) 😌' },
        { id: 'Romantic', label: 'Romantic (浪漫) 💕' },
        { id: 'Vibrant / Energetic', label: 'Vibrant / Energetic (活力/动感) 🔆' },
      ],
      audience: [
          { id: 'Young Woman (20-30, fashion/lifestyle)', label: 'Young Woman (20-30, fashion/lifestyle) (年轻女性)' },
          { id: 'Mom (family, gift angle)', label: 'Mom (family, gift angle) (妈妈)' },
          { id: 'Couple (romantic, anniversary, Valentine’s)', label: 'Couple (romantic, anniversary) (情侣)' },
          { id: 'Friends (sharing, gifting, social hangout)', label: 'Friends (sharing, gifting) (朋友)' },
      ],
      closeUpDetails: [
        { id: 'Texture Detail', label: 'Texture Detail (纹理细节) ✨' },
        { id: 'On Hand', label: 'On Hand (手上特写) ✋' },
        { id: 'Reflection', label: 'Reflection (反射效果) 💧' },
        { id: 'In Flat Lay', label: 'In Flat Lay (平铺一角) 📸' },
        { id: 'Peeking Out', label: 'Peeking Out (探出包外) 👜' },
      ]
  };

  const styleFilters = [
    {
      category: 'Fuji Series (富士胶片模拟)',
      filters: [
        { id: 'fuji_classic_chrome', label: 'Classic Chrome', description: '偏冷静纪录片感，常见于街拍、纪实摄影。' },
        { id: 'fuji_classic_negative', label: 'Classic Negative', description: '复古胶片感，怀旧情绪。' },
        { id: 'fuji_provia_velvia', label: 'Provia / Velvia', description: 'Provia 中性纪实，Velvia 色彩浓烈，适合风景 and 人像强调氛围。' },
        { id: 'fuji_acros', label: 'Acros', description: '黑白模拟，高对比，人物质感突出。' },
      ],
    },
    {
      category: 'Kodak Series',
      filters: [
        { id: 'kodak_portra_400', label: 'Kodak Portra 400/800', description: '美式婚礼、人物肖像最爱，温暖肤色、自然胶片颗粒。' },
        { id: 'kodak_gold_200', label: 'Kodak Gold 200', description: '复古家庭相册 vibe，偏暖怀旧。' },
        { id: 'kodak_kodachrome', label: 'Kodachrome', description: '传奇滤镜，饱和、厚重，典型 60–70 年代美国纪实感。' },
      ],
    },
    {
        category: 'Monochrome & Noir (黑白 & 黑色电影)',
        filters: [
            { id: 'bw_ilford_hp5', label: 'Ilford HP5 Plus', description: '经典新闻摄影风，中等颗粒，宽容度高。' },
            { id: 'bw_tri_x', label: 'Kodak Tri-X 400', description: '高对比度，粗颗粒，具有戏剧性的结构感。' },
            { id: 'bw_noir', label: 'Film Noir / Chiaroscuro', description: '黑色电影风格，高对比光影，神秘氛围。' },
        ],
    },
    {
        category: 'Leica & Cinematic Styles (徕卡 & 电影风格)',
        filters: [
            { id: 'leica_look', label: 'Leica Look', description: '高动态宽容度，暗部保留细节，带一点“高冷、锐利”的欧洲摄影师风味。' },
            { id: 'cinematic_teal_orange', label: 'Teal & Orange', description: '好莱坞风，人物肤色偏暖，背景偏青蓝，高对比，常见动作片/大片。' },
            { id: 'cinematic_wes_anderson', label: 'Wes Anderson Palette', description: '柔和对称，粉、黄、绿等莫兰迪色调，适合轻松/童话感人物。' },
            { id: 'cinematic_cyberpunk', label: 'Blade Runner / Cyberpunk', description: '霓虹紫+青蓝，赛博未来感，人物氛围神秘。' },
        ],
    },
    {
        category: 'Art & Experimental (艺术 & 实验)',
        filters: [
            { id: 'art_vaporwave', label: 'Vaporwave / Synthwave', description: '霓虹粉蓝，80年代复古未来主义，Lo-fi 质感。' },
            { id: 'art_dreamcore', label: 'Dreamcore / Ethereal', description: '柔焦，重度光晕，超现实梦境感。' },
            { id: 'art_oil_painting', label: 'Oil Painting Texture', description: '油画笔触质感，古典艺术风格。' },
        ]
    },
    {
        category: 'High-End Editorial (高端杂志)',
        filters: [
             { id: 'fashion_voguestyle', label: 'Vogue Editorial', description: '锐利焦点，高级棚拍光效，自信大胆的构图。' },
             { id: 'fashion_high_key', label: 'High Key Studio', description: '明亮，极简阴影，干净的白色背景，商业高级感。' },
        ]
    },
    {
        category: 'Social Media & Moody Styles (社交媒体 & 情绪风格)',
        filters: [
            { id: 'social_vsco', label: 'VSCO A4 / A6', description: '小清新网红滤镜，适合日常人物、生活方式。' },
            { id: 'social_huji', label: 'Huji Cam', description: '仿 90 年代一次性相机，带漏光效果，怀旧青春 vibe。' },
            { id: 'social_gingham', label: 'Instagram Gingham', description: '柔和淡色，少女风格。' },
            { id: 'moody_dark', label: 'Moody Dark Tone', description: '欧美人像常用，低饱和、高对比，突出氛围感。' },
            { id: 'soft_pastel', label: 'Soft Pastel', description: '日韩博主常用，肤色干净，整体梦幻感。' },
            { id: 'street_gritty', label: 'Street Gritty', description: '偏冷调+颗粒，突出街头人物的力量感。' },
        ]
    }
  ];
    
   const socialPlatforms = [
        { id: 'Instagram', icon: <InstagramIcon /> },
        { id: 'Facebook', icon: <FacebookIcon /> },
        { id: 'TikTok', icon: <TikTokIcon /> },
        { id: 'YouTube', icon: <YouTubeIcon /> },
        { id: 'Pinterest', icon: <PinterestIcon /> },
        { id: 'X', icon: <XIcon /> },
        { id: 'Blog', icon: <BlogIcon /> },
    ];

  const socialStrategyOptions = [
      { id: 'authenticity', label: 'Authentic & Relatable (真实/生活化)', description: 'Focus on behind-the-scenes, everyday moments, and a UGC feel.' },
      { id: 'humor', label: 'Humorous & Playful (幽默/顽皮)', description: 'Use memes, puns, and a witty, self-aware brand voice. The persona is relaxed, down-to-earth, and maybe a bit self-deprecating or exaggerated. Aim for surprise and delight, but be mindful of brand consistency and avoid being offensive.' },
      { id: 'niche', label: 'Niche & Personalized (个性化/圈子)', description: 'Target a specific community with inside jokes and specialized language.' },
      { id: 'ai_collab', label: 'AI Co-created (AI 共创)', description: 'A transparent, meta, and slightly experimental tone acknowledging the AI partnership.' },
      { id: 'fast_paced', label: 'Short Video / Quick Bite (短视频/快节奏)', description: 'Content optimized for Reels/TikTok with a strong hook and high energy.' },
      { id: 'educational', label: 'Educational & Informative (知识/信息型)', description: 'Teach the audience something useful about the product or industry.' },
      { id: 'bts', label: 'Behind-the-Scenes (幕后花eces)', description: 'Showcase the making-of process, the people, or the story behind the product.' },
      { id: 'ugc', label: 'UGC Showcase (用户内容展示)', description: 'Feature content from customers to build community and social proof.' },
  ];

  const totalSelectedCount = selectedAngles.length + selectedProductStudioAngles.length + customAngles.length;
  const currentTotalOutputs = totalSelectedCount * imagesPerAngle;

    const handleConnectApiKey = async () => {
        try {
            const aiStudio = (window as any).aistudio;
            if (aiStudio && typeof aiStudio.openSelectKey === 'function') {
                await aiStudio.openSelectKey();
                // Assume success and proceed
                setHasApiKey(true);
            } else {
                // Fallback for environments where the tool isn't available
                setHasApiKey(true);
            }
        } catch (error) {
            console.error("Error selecting API key:", error);
            setHasApiKey(true); // Proceed anyway to avoid blocking
        }
    };

    const handleAngleTagChange = (angleId: string) => {
        const isSelected = selectedAngles.includes(angleId);
        const newTotalCount = isSelected ? totalSelectedCount - 1 : totalSelectedCount + 1;
        const newTotalOutputs = newTotalCount * imagesPerAngle;

        if (!isSelected && newTotalOutputs > MAX_TOTAL_IMAGES) {
             setError(`Total images cannot exceed ${MAX_TOTAL_IMAGES}. Decrease "Images per Perspective" or deselect other angles.`);
            return;
        }
        setError(null);
        if (isSelected) {
            setSelectedAngles(prev => prev.filter(id => id !== angleId));
        } else {
            setSelectedAngles(prev => [...prev, angleId]);
        }
    };
    
    // Updated: Focus Subject does NOT affect image count anymore.
    const handleFocusSubjectChange = (subjectId: string) => {
        if (selectedFocusSubjects.includes(subjectId)) {
            setSelectedFocusSubjects(prev => prev.filter(id => id !== subjectId));
        } else {
            setSelectedFocusSubjects(prev => [...prev, subjectId]);
        }
    };
    
    const handleProductAngleTagChange = (angleId: string) => {
        const isSelected = selectedProductStudioAngles.includes(angleId);
        const newTotalCount = isSelected ? totalSelectedCount - 1 : totalSelectedCount + 1;
        const newTotalOutputs = newTotalCount * imagesPerAngle;

        if (!isSelected && newTotalOutputs > MAX_TOTAL_IMAGES) {
             setError(`Total images cannot exceed ${MAX_TOTAL_IMAGES}. Decrease "Images per Perspective" or deselect other angles.`);
            return;
        }
        setError(null);
        if (isSelected) {
            setSelectedProductStudioAngles(prev => prev.filter(id => id !== angleId));
        } else {
            setSelectedProductStudioAngles(prev => [...prev, angleId]);
        }
    };
  
    const handleAddCustomAngle = () => {
        const newAngle = currentCustomAngle.trim();
        if (newAngle && !customAngles.includes(newAngle)) {
            const newTotalCount = totalSelectedCount + 1;
            const newTotalOutputs = newTotalCount * imagesPerAngle;

            if (newTotalOutputs > MAX_TOTAL_IMAGES) {
                setError(`Total images cannot exceed ${MAX_TOTAL_IMAGES}. Decrease "Images per Perspective" or deselect other angles.`);
                return;
            }
            setError(null);
            setCustomAngles([...customAngles, newAngle]);
            setCurrentCustomAngle('');
        }
    };

    const handleRemoveCustomAngle = (angleToRemove: string) => {
        setCustomAngles(customAngles.filter(angle => angle !== angleToRemove));
    };

    const handleCustomAngleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddCustomAngle();
        }
    };

    const handleBrainstormAngles = async () => {
        if (uploadedImages.length === 0) {
            setError('Please upload a main image first for the AI to analyze.');
            return;
        }
        setIsBrainstorming(true);
        setError(null);
        try {
             const mainImage = uploadedImages[0];
             const mainImageRef = {
                base64: mainImage.split(',')[1],
                mimeType: mainImage.split(';')[0].split(':')[1],
            };
            const suggestedAngles = await generateBrainstormAngles(mainImageRef, { name: productName, sellingPoints, link: '' });
            
            if (suggestedAngles && suggestedAngles.length > 0) {
                 setCustomAngles(prev => {
                    const availableSlots = Math.floor((MAX_TOTAL_IMAGES - (selectedAngles.length + selectedProductStudioAngles.length) * imagesPerAngle) / imagesPerAngle);
                    if (availableSlots <= 0) {
                         setError("Please deselect some standard angles or reduce quantity to make room for brainstormed ideas.");
                         return prev;
                    }
                    const newAngles = [...prev, ...suggestedAngles].slice(0, availableSlots);
                    return newAngles;
                 });
            }
        } catch (e) {
            setError("Failed to brainstorm angles. Please try again.");
            console.error(e);
        } finally {
            setIsBrainstorming(false);
        }
    };

  const handleAnalyzeImage = async () => {
     if (uploadedImages.length === 0) {
         setError('Please upload an image first.');
         return;
     }
     setIsAnalyzing(true);
     setError(null);
     try {
        const mainImage = uploadedImages[0];
        const mainImageRef = {
           base64: mainImage.split(',')[1],
           mimeType: mainImage.split(';')[0].split(':')[1],
       };
       const result = await analyzeImage(mainImageRef);
       setAnalysisText(result);
       setIsAnalysisOpen(true);
     } catch (e) {
         setError('Failed to analyze image. Please try again.');
         console.error(e);
     } finally {
         setIsAnalyzing(false);
     }
  };

  const handleLifestyleTagChange = (category: keyof typeof lifestyleScene, value: string) => {
    setLifestyleScene(prev => {
        const currentValues = prev[category] as string[];
        const newValues = currentValues.includes(value) 
            ? currentValues.filter(item => item !== value) // Deselect
            : [...currentValues, value]; // Select
        return { ...prev, [category]: newValues };
    });
  };

  const handleCustomLifestyleChange = (category: keyof typeof customLifestyle, value: string) => {
    setCustomLifestyle(prev => ({ ...prev, [category]: value }));
  };

  const handleSocialStrategyChange = (strategyId: string) => {
      setSelectedSocialStrategies(prev => prev.includes(strategyId) ? prev.filter(id => id !== strategyId) : [...prev, strategyId]);
  };
  
  const handleSocialPlatformChange = (platformId: string) => {
    setSelectedSocialPlatforms(prev => 
        prev.includes(platformId)
        ? prev.filter(id => id !== platformId)
        : [...prev, platformId]
    );
  };
  
  const handleImagesPerAngleChange = (newQuantity: number) => {
      // Validate total limit before setting
      const totalOutputs = totalSelectedCount * newQuantity;
      if (totalOutputs > MAX_TOTAL_IMAGES) {
          setError(`Cannot set quantity to ${newQuantity}. Total images would exceed ${MAX_TOTAL_IMAGES} (${totalSelectedCount} angles x ${newQuantity}). Please deselect some angles first.`);
          return;
      }
      setError(null);
      setImagesPerAngle(newQuantity);
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const filesToProcess = Array.from(files).slice(0, 3 - uploadedImages.length);
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
    setGeneratedData(null);
    setError(null);
  };
  
  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages(prev => prev.filter((_, index) => index !== indexToRemove));
    if (indexToRemove === 0) {
      setFocusArea(null); // Reset focus if main image is removed
    }
  };

  const handleReferenceFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const filesToProcess = Array.from(files).slice(0, 3 - referenceImages.length);
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveReferenceImage = (indexToRemove: number) => {
    setReferenceImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  
  const handleFocusAreaChange = (area: FocusArea | null) => {
    setFocusArea(area);
  };

  const handleUpdatePerspectiveImage = (perspectiveId: string, newImage: GeneratedImage) => {
    if (!generatedData) return;
    const updatedPerspectives = generatedData.perspectives.map(p => {
        if (p.id === perspectiveId) {
            return { ...p, mainImage: newImage };
        }
        return p;
    });
    setGeneratedData({ ...generatedData, perspectives: updatedPerspectives });
  };

  const handleAppendPerspectives = (newPerspectives: GeneratedPerspective[]) => {
    if (!generatedData) return;
    setGeneratedData(prevData => {
        if (!prevData) return null;
        return { 
            ...prevData, 
            perspectives: [...prevData.perspectives, ...newPerspectives] 
        };
    });
  };
  
  const handleSavePreset = () => {
    const name = window.prompt('Enter a name for your preset:');
    if (name && name.trim()) {
        const trimmedName = name.trim();
        if (presets.some(p => p.name === trimmedName)) {
            alert(`A preset with the name "${trimmedName}" already exists. Please choose a different name.`);
            return;
        }
        const newPreset: Preset = {
            name: trimmedName,
            settings: {
                selectedAngles,
                selectedProductStudioAngles,
                selectedFocusSubjects, // Save new state
                customAngles,
                generateMultiPerson,
                generateScene,
                consistencyMode,
                sensualMode,
                ugcMode, // Save new UGC state
                lifestyleScene,
                customLifestyle,
                targetRegion, // Save new state
                targetAudience, // Save new state
                selectedSocialStrategies,
                selectedSocialPlatforms,
                selectedStyleFilter,
                referenceImages,
                aspectRatio,
                customDimensions: { width: customWidth, height: customHeight },
                imagesPerAngle,
                videoPromptConfig
            }
        };
        const updatedPresets = [...presets, newPreset];
        setPresets(updatedPresets);
        localStorage.setItem('contentCatalystPresets', JSON.stringify(updatedPresets));
        alert(`Preset "${trimmedName}" saved!`);
    }
  };

  const handleLoadPreset = (presetName: string) => {
    const preset = presets.find(p => p.name === presetName);
    if (preset) {
        const { settings } = preset;
        setSelectedAngles(settings.selectedAngles);
        setSelectedProductStudioAngles(settings.selectedProductStudioAngles || []);
        setSelectedFocusSubjects(settings.selectedFocusSubjects || []); // Load new state
        setCustomAngles(settings.customAngles || []);
        setGenerateMultiPerson(settings.generateMultiPerson);
        setGenerateScene(settings.generateScene);
        setConsistencyMode(settings.consistencyMode || false);
        setSensualMode(settings.sensualMode || false); 
        setUgcMode(settings.ugcMode || false); // Load new UGC state
        setLifestyleScene(settings.lifestyleScene);
        setCustomLifestyle(settings.customLifestyle);
        setTargetRegion(settings.targetRegion || ''); // Load new state
        setTargetAudience(settings.targetAudience || ''); // Load new state
        setSelectedSocialStrategies(settings.selectedSocialStrategies);
        setSelectedSocialPlatforms(settings.selectedSocialPlatforms);
        setSelectedStyleFilter(settings.selectedStyleFilter);
        setReferenceImages(settings.referenceImages || []);
        if (settings.aspectRatio) setAspectRatio(settings.aspectRatio);
        if (settings.customDimensions) {
            setCustomWidth(settings.customDimensions.width);
            setCustomHeight(settings.customDimensions.height);
        }
        if (settings.imagesPerAngle) setImagesPerAngle(settings.imagesPerAngle);
        if (settings.videoPromptConfig) setVideoPromptConfig(settings.videoPromptConfig);
        alert(`Preset "${presetName}" loaded!`);
    }
  };

  const handleDeletePreset = (presetName: string) => {
    if (window.confirm(`Are you sure you want to delete the preset "${presetName}"?`)) {
        const updatedPresets = presets.filter(p => p.name !== presetName);
        setPresets(updatedPresets);
        localStorage.setItem('contentCatalystPresets', JSON.stringify(updatedPresets));
        alert(`Preset "${presetName}" deleted.`);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (uploadedImages.length === 0) {
      setError('Please upload at least one main image.');
      return;
    }

    const finalAngles = [...selectedAngles, ...selectedProductStudioAngles];
    if (customAngles.length > 0) {
        customAngles.forEach(angle => {
            finalAngles.push(`custom:${angle.trim()}`);
        });
    }

    if (finalAngles.length === 0) {
      setError('Please select at least one perspective (Shot & Angle) to generate.');
      return;
    }
    
    const totalOutputs = finalAngles.length * imagesPerAngle;
    if (totalOutputs > MAX_TOTAL_IMAGES) {
      setError(`You are attempting to generate ${totalOutputs} images. The maximum allowed is ${MAX_TOTAL_IMAGES}. Please reduce angles or quantity.`);
      return;
    }

    setIsLoading(true);
    setGeneratedData(null);
    setError(null);

    try {
      setLoadingMessage('Preparing images...');
      
      const [mainImage, ...secondaryImages] = uploadedImages;
      const mainImageRef = {
          base64: mainImage.split(',')[1],
          mimeType: mainImage.split(';')[0].split(':')[1],
      };
      
      const secondaryImagesRef = secondaryImages.map(img => ({
          base64: img.split(',')[1],
          mimeType: img.split(';')[0].split(':')[1],
      }));
      
      const referenceImagesRef = referenceImages.map(img => ({
          base64: img.split(',')[1],
          mimeType: img.split(';')[0].split(':')[1],
      }));

      let focusImageRef = null;
      if (focusArea && mainImage) {
        const croppedImageBase64 = await cropImage(mainImage, focusArea);
        focusImageRef = {
            base64: croppedImageBase64.split(',')[1],
            mimeType: croppedImageBase64.split(';')[0].split(':')[1],
        };
      }
      
      const generationOptions = {
        selectedAngles: finalAngles,
        selectedFocusSubjects, // Pass the new focus subjects
        generateMultiPerson,
        generateScene,
        consistencyMode,
        sensualMode, 
        ugcMode, // Pass new UGC mode
        generateSocialCopy,
        creativityBoost,
        lifestyleScene,
        selectedSocialPlatforms,
        selectedSocialStrategies,
        styleFilter: selectedStyleFilter,
        targetRegion, // Pass the new target region
        targetAudience, // Pass the new target audience
        aspectRatio,
        customDimensions: { width: customWidth, height: customHeight },
        imagesPerAngle,
        videoPromptConfig
      };

      const productInfo = {
        name: productName,
        sellingPoints: sellingPoints,
        link: productLink
      };

      const data = await generateContentFromImage(
        mainImageRef,
        secondaryImagesRef,
        focusImageRef,
        referenceImagesRef,
        productInfo,
        generationOptions,
        customLifestyle,
        generationDescription,
        setLoadingMessage
      );
      setGeneratedData(data);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [uploadedImages, referenceImages, focusArea, productName, sellingPoints, productLink, selectedAngles, selectedProductStudioAngles, customAngles, selectedFocusSubjects, generateMultiPerson, generateScene, consistencyMode, sensualMode, ugcMode, generateSocialCopy, creativityBoost, lifestyleScene, selectedSocialPlatforms, customLifestyle, generationDescription, selectedStyleFilter, selectedSocialStrategies, targetRegion, targetAudience, aspectRatio, customWidth, customHeight, imagesPerAngle, videoPromptConfig]);
  
  const handleExpandGeneration = useCallback(async (expansionPrompt: string) => {
      if (!expansionPrompt.trim() || !generatedData) {
          setError("Please enter a prompt to expand on the results.");
          return;
      }
      setIsExpanding(true);
      setError(null);

      try {
          const [mainImage, ...secondaryImages] = uploadedImages;
          const mainImageRef = {
              base64: mainImage.split(',')[1],
              mimeType: mainImage.split(';')[0].split(':')[1],
          };
          const secondaryImagesRef = secondaryImages.map(img => ({
              base64: img.split(',')[1],
              mimeType: img.split(';')[0].split(':')[1],
          }));
           const referenceImagesRef = referenceImages.map(img => ({
              base64: img.split(',')[1],
              mimeType: img.split(';')[0].split(':')[1],
          }));

          let focusImageRef = null;
          if (focusArea && mainImage) {
              const croppedImageBase64 = await cropImage(mainImage, focusArea);
              focusImageRef = {
                  base64: croppedImageBase64.split(',')[1],
                  mimeType: croppedImageBase64.split(';')[0].split(':')[1],
              };
          }

          const generationOptions = {
              selectedAngles: [],
              selectedFocusSubjects: [], // Expansion is custom prompt based
              generateMultiPerson,
              generateScene,
              consistencyMode,
              sensualMode,
              ugcMode, // Keep UGC mode state for expansions
              generateSocialCopy,
              creativityBoost,
              lifestyleScene,
              selectedSocialPlatforms,
              selectedSocialStrategies,
              styleFilter: selectedStyleFilter,
              targetRegion,
              targetAudience,
              aspectRatio,
              customDimensions: { width: customWidth, height: customHeight },
              imagesPerAngle: 1, 
              videoPromptConfig
          };

          const productInfo = {
              name: productName,
              sellingPoints: sellingPoints,
              link: productLink
          };
          
          const newPerspectives = await generateMoreImages(
              mainImageRef,
              secondaryImagesRef,
              focusImageRef,
              referenceImagesRef,
              productInfo,
              generationOptions,
              customLifestyle,
              generatedData.perspectives,
              expansionPrompt,
              setLoadingMessage
          );

          handleAppendPerspectives(newPerspectives);

      } catch(e) {
          console.error(e);
          setError(e instanceof Error ? `An unknown error occurred while expanding: ${e.message}` : 'An unknown error occurred while expanding.');
      } finally {
          setIsExpanding(false);
      }
  }, [generatedData, uploadedImages, referenceImages, focusArea, productName, sellingPoints, productLink, generateMultiPerson, generateScene, consistencyMode, sensualMode, ugcMode, generateSocialCopy, creativityBoost, lifestyleScene, selectedSocialPlatforms, customLifestyle, selectedStyleFilter, selectedSocialStrategies, targetRegion, targetAudience, aspectRatio, customWidth, customHeight, videoPromptConfig]);

  const handleRegeneratePerspective = async (perspectiveId: string) => {
        if (!generatedData) return;
        
        const perspectiveToRegen = generatedData.perspectives.find(p => p.id === perspectiveId);
        if (!perspectiveToRegen) return;
        
        // Set loading state and clear previous error
        setGeneratedData(prev => prev ? { ...prev, perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, isRegenerating: true, error: undefined } : p) } : null);

        try {
            const [mainImage, ...secondaryImages] = uploadedImages;
            const mainImageRef = { base64: mainImage.split(',')[1], mimeType: mainImage.split(';')[0].split(':')[1] };
            const secondaryImagesRef = secondaryImages.map(img => ({ base64: img.split(',')[1], mimeType: img.split(';')[0].split(':')[1] }));
            const referenceImagesRef = referenceImages.map(img => ({ base64: img.split(',')[1], mimeType: img.split(';')[0].split(':')[1] }));
            
            let focusImageRef = null;
            if (focusArea && mainImage) {
                const croppedImageBase64 = await cropImage(mainImage, focusArea);
                focusImageRef = { base64: croppedImageBase64.split(',')[1], mimeType: croppedImageBase64.split(';')[0].split(':')[1] };
            }

            const newImage = await generateSingleImage(perspectiveToRegen.prompt, mainImageRef, secondaryImagesRef, focusImageRef, referenceImagesRef, aspectRatio, { width: customWidth, height: customHeight });

            // Update state with new image
            setGeneratedData(prev => prev ? {
                ...prev,
                perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, mainImage: newImage, isRegenerating: false } : p)
            } : null);
        } catch(e) {
            console.error('Regeneration failed:', e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during regeneration.';
            setGeneratedData(prev => prev ? { ...prev, perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, isRegenerating: false, error: errorMessage } : p) } : null);
        }
    };
    
  const handleExtendFrame = async (perspectiveId: string) => {
        if (!generatedData) return;
        
        const perspectiveToExtend = generatedData.perspectives.find(p => p.id === perspectiveId);
        if (!perspectiveToExtend) return;

        // Set loading state and clear previous error
        setGeneratedData(prev => prev ? { ...prev, perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, isExtending: true, error: undefined } : p) } : null);
        
        try {
            const originalImageRef = {
                base64: perspectiveToExtend.mainImage.src.split(',')[1],
                mimeType: perspectiveToExtend.mainImage.src.split(';')[0].split(':')[1],
            };
            const { extendedImages, transitionText } = await extendFrameForVideo(originalImageRef);

            setGeneratedData(prev => prev ? {
                ...prev,
                perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, extendedFrames: extendedImages, transitionText, isExtending: false } : p)
            } : null);
        } catch (e) {
            console.error('Frame extension failed:', e);
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during frame extension.';
            setGeneratedData(prev => prev ? { ...prev, perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, isExtending: false, error: errorMessage } : p) } : null);
        }
    };

    const handleClearPerspectiveError = (perspectiveId: string) => {
      if (!generatedData) return;
      setGeneratedData(prev => prev ? {
          ...prev,
          perspectives: prev.perspectives.map(p => p.id === perspectiveId ? { ...p, error: undefined } : p)
      } : null);
    };
    
    if (!hasApiKey) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
                 <div className="absolute inset-0 pointer-events-none opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMWgydjJIMUMxeiIgZmlsbD0iIzMzMyIgZmlsbC1vcGFjaXR5PSIwLjEiLz48L3N2Zz4=')]"></div>
                <div className="bg-slate-900 border border-slate-700 p-10 rounded-2xl max-w-md text-center shadow-2xl relative z-10 animate-fade-in">
                    <h1 className="text-3xl font-monument tracking-tighter apple-header-gradient mb-6 drop-shadow-lg">
                        RARE VISUAL CATALYST 3.6
                    </h1>
                    <p className="text-slate-400 mb-8 leading-relaxed">
                        This application now uses the advanced <strong className="text-white">Nano Banana Pro (Gemini 3.0 Pro)</strong> model for ultra-high-quality generation.
                        <br/><br/>
                        To access these paid models, you must connect a valid API key from a billing-enabled project.
                    </p>
                    <button 
                        onClick={handleConnectApiKey}
                        className="w-full py-3.5 bg-white hover:bg-slate-200 text-black font-bold rounded-xl transition-colors text-lg shadow-lg"
                    >
                        Connect API Key
                    </button>
                    <p className="text-xs text-slate-600 mt-6">
                        By connecting, you agree to the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">billing terms</a>.
                    </p>
                </div>
            </div>
        );
    }

  return (
    <div className="min-h-screen main-container text-slate-200 font-sans relative">
      <Orb hue={200} hoverIntensity={0.1} />
      <main className="container mx-auto px-4 py-8 relative z-10">
        <header className="text-center mb-12">
          {/* UPDATED HEADER with Visual Effects */}
          <h1 className="text-4xl md:text-6xl font-monument tracking-tighter drop-shadow-sm">
            <span className="text-shimmer">RARE VISUAL CATALYST 3.6</span>
          </h1>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6 rounded-xl shadow-lg">
              <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                 <h2 className="text-xl font-semibold text-white">1. Upload Images & Select Focus (上传图片 & 选择焦点)</h2>
              </div>
              
              <input
                type="file"
                multiple
                accept="image/*"
                ref={fileInputRef}
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              {uploadedImages.length === 0 ? (
                  <button 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-full h-32 flex items-center justify-center border-2 border-dashed border-slate-700 rounded-md hover:border-lime-400 transition-colors text-slate-500 hover:text-lime-400"
                  >
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                      <span className="mt-2 block text-sm font-medium">Add Subject Images (添加主体图片)</span>
                      <span className="block text-xs">Up to 3 images (最多3张)</span>
                    </div>
                  </button>
              ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 items-start">
                    {uploadedImages.map((image, index) => (
                        <div
                        key={index}
                        className={`relative aspect-square group col-span-1 p-0.5 rounded-lg ${index === 0 ? 'ring-2 ring-lime-400' : ''}`}
                        >
                        {index === 0 ? (
                            <FocusableImage src={image} focusArea={focusArea} onChange={handleFocusAreaChange} />
                        ) : (
                            <img src={image} alt={`Reference ${index + 1}`} className="w-full h-full object-cover rounded-md shadow-md" />
                        )}
                        <button onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 p-1 bg-slate-900/70 rounded-full text-slate-300 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        {index === 0 && <span className="absolute -bottom-5 left-0 text-xs text-lime-400 font-semibold">Main Image (主图)</span>}
                        </div>
                    ))}
                    {uploadedImages.length < 3 && (
                        <button 
                        onClick={() => fileInputRef.current?.click()} 
                        className="aspect-square flex items-center justify-center border-2 border-dashed border-slate-700 rounded-md hover:border-lime-400 transition-colors col-span-1"
                        >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        </button>
                    )}
                    </div>
                     <button 
                        onClick={handleAnalyzeImage}
                        disabled={isAnalyzing || uploadedImages.length === 0}
                        className="w-full mt-4 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-slate-600"
                     >
                         {isAnalyzing ? <span className="animate-pulse">Analyzing...</span> : (
                             <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                                🔍 Analyze Image (AI 视觉分析)
                             </>
                         )}
                     </button>
                 </div>
              )}
               {uploadedImages.length > 0 && <p className="text-xs text-slate-500 mt-2 text-center pt-4">The first image is the main subject. Click the expand button for precision focus.</p>}
               
               <div className="mt-6 border-t border-slate-700 pt-4">
                  <h3 className="text-base font-semibold text-slate-300 mb-3">Style Reference Images (风格参考图)</h3>
                   <input
                        type="file"
                        multiple
                        accept="image/*"
                        ref={referenceFileInputRef}
                        onChange={(e) => handleReferenceFilesSelected(e.target.files)}
                        className="hidden"
                    />
                    <div className="grid grid-cols-3 gap-3">
                        {referenceImages.map((image, index) => (
                            <div key={index} className="relative aspect-square group col-span-1">
                                <img src={image} alt={`Reference ${index + 1}`} className="w-full h-full object-cover rounded-md shadow-md" />
                                <button onClick={() => handleRemoveReferenceImage(index)} className="absolute top-1 right-1 p-1 bg-slate-900/70 rounded-full text-slate-300 hover:bg-red-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 z-10">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                        {referenceImages.length < 3 && (
                            <button
                                onClick={
                                    () => referenceFileInputRef.current?.click()}
                                className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-md hover:border-lime-400 transition-colors text-slate-600 hover:text-lime-400"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                <span className="text-xs mt-1">Add Style Ref</span>
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Upload up to 3 images to guide the AI's style, mood, and color palette.</p>
               </div>


               <div className="mt-6 border-t border-slate-700 pt-4 space-y-4">
                  <div>
                    <label htmlFor="generationDescription" className="block text-sm font-medium text-slate-300">Overall Content Description (整体内容描述)</label>
                    <textarea
                      id="generationDescription"
                      value={generationDescription}
                      onChange={(e) => setGenerationDescription(e.target.value)}
                      rows={3}
                      placeholder="e.g., A professional product shot for an e-commerce website, with a clean white background and soft, natural lighting. (例如, 用于电子商务网站的专业产品照片...)"
                      className="mt-1 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2 text-slate-300">
                      <input type="checkbox" className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-lime-400 focus:ring-lime-400" checked={generateMultiPerson} onChange={e => setGenerateMultiPerson(e.target.checked)} />
                      <span>Generate Multi-Person Image (生成多人图片)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-300">
                      <input type="checkbox" className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-lime-400 focus:ring-lime-400" checked={generateScene} onChange={e => setGenerateScene(e.target.checked)} />
                      <span>Generate Scene (生成场景图片)</span>
                    </label>
                    <label className="flex items-center space-x-2 text-slate-300">
                      <input type="checkbox" className="h-4 w-4 rounded bg-slate-800 border-slate-600 text-lime-400 focus:ring-lime-400" checked={generateSocialCopy} onChange={e => setGenerateSocialCopy(e.target.checked)} />
                      <span>Generate Social Media Post (生成社媒文案)</span>
                    </label>
                  </div>
                  <div>
                    <label htmlFor="campaignName" className="block text-sm font-medium text-slate-300">Campaign Name (for downloads) (活动名称)</label>
                    <input type="text" id="campaignName" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g., Summer Collection 2024 (例如, 2024夏季系列)" className="mt-1 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                  </div>
                  
                  {/* Output Dimensions Section */}
                   <div>
                       <label className="block text-sm font-medium text-slate-300 mb-2">Output Dimensions (输出尺寸)</label>
                       <div className="grid grid-cols-4 gap-2 mb-2">
                           {['1:1', '16:9', '9:16', 'custom'].map((ratio) => (
                               <button
                                   key={ratio}
                                   onClick={() => setAspectRatio(ratio)}
                                   className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                       aspectRatio === ratio
                                       ? 'bg-lime-900/50 border-lime-400 text-lime-300 ring-2 ring-lime-400/50'
                                       : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                   }`}
                               >
                                   {ratio === 'custom' ? 'Custom' : ratio}
                               </button>
                           ))}
                       </div>
                       {aspectRatio === 'custom' && (
                           <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 space-y-3">
                               <div className="flex gap-3 items-center">
                                   <div className="flex-1">
                                       <label className="block text-xs text-slate-500 mb-1">Width (px)</label>
                                       <input 
                                           type="number" 
                                           value={customWidth} 
                                           onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-lime-400 outline-none text-slate-200"
                                       />
                                   </div>
                                   <span className="text-slate-500 pt-4">x</span>
                                   <div className="flex-1">
                                       <label className="block text-xs text-slate-500 mb-1">Height (px)</label>
                                       <input 
                                           type="number" 
                                           value={customHeight} 
                                           onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                                           className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-lime-400 outline-none text-slate-200"
                                       />
                                   </div>
                               </div>
                           </div>
                       )}
                   </div>
               </div>
            </div>
            
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6 rounded-xl shadow-lg">
                <div 
                    className="flex justify-between items-center cursor-pointer"
                    onClick={() => setOpenAccordion(openAccordion === 'product' ? '' : 'product')}
                >
                    <h2 className="text-xl font-semibold text-white">2. Add Product & Brand Details (添加产品 & 品牌信息)</h2>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform text-slate-400 ${openAccordion === 'product' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
                {openAccordion === 'product' && (
                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-4">
                      <div>
                        <label htmlFor="productName" className="block text-sm font-medium text-slate-300">Product Name (产品名称)</label>
                        <input type="text" id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g., The Minimalist Watch (例如, 极简主义手表)" className="mt-1 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                      </div>
                      <div>
                        <label htmlFor="sellingPoints" className="block text-sm font-medium text-slate-300">Key Selling Points (核心卖点)</label>
                        <textarea id="sellingPoints" value={sellingPoints} onChange={(e) => setSellingPoints(e.target.value)} rows={3} placeholder="e.g., Hand-crafted leather strap, Sapphire crystal glass... (例如, 手工制作的皮革表带...)" className="mt-1 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                      </div>
                      <div>
                        <label htmlFor="productLink" className="block text-sm font-medium text-slate-300">Product Link (产品链接)</label>
                        <input type="text" id="productLink" value={productLink} onChange={(e) => setProductLink(e.target.value)} placeholder="e.g., www.yourstore.com/product (例如, www.yourstore.com/product)" className="mt-1 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                      </div>
                    </div>
                )}
            </div>

            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6 rounded-xl shadow-lg">
              <h2 className="text-xl font-semibold mb-4 border-b border-slate-700 pb-2 text-white">3. Select Perspectives (选择视角)</h2>
              <div className="space-y-1">
                  <CollapsibleSection 
                    title={`Shot Size & Angle (景别 & 角度) (Total Output: ${currentTotalOutputs}/${MAX_TOTAL_IMAGES})`} 
                    isOpen={openAccordion === 'perspectives'} 
                    onToggle={() => setOpenAccordion(openAccordion === 'perspectives' ? '' : 'perspectives')}
                  >
                     <div className="mb-4 space-y-4">
                         {/* Images per Perspective Input */}
                         <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex-1">
                                <label htmlFor="imagesPerAngle" className="block text-sm font-medium text-lime-300 mb-1">
                                    Images per Perspective (每种视角生成数量)
                                </label>
                                <p className="text-xs text-slate-500">Generate multiple variations for each selected angle.</p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-900 rounded-lg p-1 border border-slate-700">
                                <button 
                                    onClick={() => handleImagesPerAngleChange(Math.max(1, imagesPerAngle - 1))} 
                                    className="p-2 hover:bg-slate-800 text-slate-300 rounded disabled:opacity-50"
                                    disabled={imagesPerAngle <= 1}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                                </button>
                                <span className="text-lg font-mono font-bold text-white min-w-[2rem] text-center">{imagesPerAngle}</span>
                                <button 
                                    onClick={() => handleImagesPerAngleChange(Math.min(10, imagesPerAngle + 1))} 
                                    className="p-2 hover:bg-slate-800 text-slate-300 rounded disabled:opacity-50"
                                    disabled={imagesPerAngle >= 10}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                                </button>
                            </div>
                         </div>

                         <button
                             onClick={handleBrainstormAngles}
                             disabled={isBrainstorming || uploadedImages.length === 0}
                             className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             {isBrainstorming ? (
                                 <>
                                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                     </svg>
                                     Brainstorming...
                                 </>
                             ) : (
                                 <>
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                         <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                     </svg>
                                     ✨ Brainstorm Angles (AI 创意风暴)
                                 </>
                             )}
                         </button>
                     </div>

                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-2">Shot & Angle (景别 & 角度)</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {shotAndAngleOptions.map(option => (
                                    <TagButton key={option.id} isSelected={selectedAngles.includes(option.id)} onClick={() => handleAngleTagChange(option.id)}>
                                        <BilingualLabel text={option.label} />
                                    </TagButton>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-2">Focus Subject (主体部位/局部) <span className="text-xs font-normal text-lime-400 ml-1">(Auxiliary optimization only)</span></h4>
                            <div className="grid grid-cols-2 gap-2">
                                {focusSubjects.map(option => (
                                    <TagButton key={option.id} isSelected={selectedFocusSubjects.includes(option.id)} onClick={() => handleFocusSubjectChange(option.id)}>
                                        <BilingualLabel text={option.label} />
                                    </TagButton>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-slate-300">Other (自定义)</label>
                        <div className="flex items-center gap-2 mt-2">
                            <input 
                                type="text" 
                                value={currentCustomAngle} 
                                onChange={(e) => setCurrentCustomAngle(e.target.value)} 
                                onKeyDown={handleCustomAngleKeyDown}
                                placeholder="e.g., Worm's-eye view, press Enter to add" 
                                className="flex-grow bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-lime-400 focus:border-lime-400" 
                            />
                            <button 
                                onClick={handleAddCustomAngle}
                                className="bg-lime-600 hover:bg-lime-500 text-white font-bold px-4 py-2 rounded-md transition-colors"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                            {customAngles.map(angle => (
                                <div key={angle} className="flex items-center gap-1 bg-fuchsia-800/50 text-fuchsia-200 text-sm px-2 py-1 rounded-full border border-fuchsia-500/30">
                                    <span>{angle}</span>
                                    <button onClick={() => handleRemoveCustomAngle(angle)} className="p-0.5 hover:bg-fuchsia-600/50 rounded-full">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                  </CollapsibleSection>
                  
                  <CollapsibleSection title={`Product Studio (白底产品图) (Total Output: ${currentTotalOutputs}/${MAX_TOTAL_IMAGES})`} isOpen={openAccordion === 'productStudio'} onToggle={() => setOpenAccordion(openAccordion === 'productStudio' ? '' : 'productStudio')}>
                    <div className="space-y-4">
                        <div>
                            <h4 className="text-sm font-medium text-slate-400 mb-2">Standard Angles (标准角度)</h4>
                            <div className="grid grid-cols-2 gap-2">
                                {productStudioAngles.map(option => (
                                    <TagButton key={option.id} isSelected={selectedProductStudioAngles.includes(option.id)} onClick={() => handleProductAngleTagChange(option.id)}>
                                        <BilingualLabel text={option.label} />
                                    </TagButton>
                                ))}
                            </div>
                        </div>
                         <p className="text-xs text-slate-500 mt-3 p-2 bg-slate-800/50 rounded-md">
                            Tip: These options generate clean product shots on a pure white background, ideal for e-commerce.
                        </p>
                    </div>
                  </CollapsibleSection>

                  <CollapsibleSection title="Creative Controls (创意标签)" isOpen={openAccordion === 'creative'} onToggle={() => setOpenAccordion(openAccordion === 'creative' ? '' : 'creative')}>
                    {/* NEW Audience and Region Section */}
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 mb-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-lime-400 text-lg">🌍</span>
                            <h4 className="font-semibold text-slate-200">Target Audience & Region (受众 & 地区)</h4>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">Target Region (目标地区)</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {['Global', 'North America', 'Europe', 'East Asia', 'Southeast Asia', 'Middle East'].map(region => (
                                    <button
                                        key={region}
                                        onClick={() => setTargetRegion(region)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                            targetRegion === region 
                                            ? 'bg-lime-900/50 border-lime-400 text-lime-300' 
                                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
                                        }`}
                                    >
                                        {region}
                                    </button>
                                ))}
                            </div>
                            <input 
                                type="text" 
                                value={targetRegion} 
                                onChange={(e) => setTargetRegion(e.target.value)} 
                                placeholder="Or type custom region (e.g., Brazil, Nordic Countries)..." 
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 focus:border-lime-400 text-slate-200 placeholder-slate-600"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-2">Target Audience (目标受众)</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {['Gen Z', 'Millennials', 'Professionals', 'Parents', 'Luxury Shoppers', 'Tech Enthusiasts'].map(audience => (
                                    <button
                                        key={audience}
                                        onClick={() => setTargetAudience(audience)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                            targetAudience === audience 
                                            ? 'bg-lime-900/50 border-lime-400 text-lime-300' 
                                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-400'
                                        }`}
                                    >
                                        {audience}
                                    </button>
                                ))}
                            </div>
                            <input 
                                type="text" 
                                value={targetAudience} 
                                onChange={(e) => setTargetAudience(e.target.value)} 
                                placeholder="Describe your audience (e.g., Eco-conscious urban dwellers)..." 
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-lime-400 focus:border-lime-400 text-slate-200 placeholder-slate-600"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-gradient-to-r from-fuchsia-900/30 to-purple-900/30 rounded-lg border border-fuchsia-500/20">
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={creativityBoost} onChange={e => setCreativityBoost(e.target.checked)} />
                                    <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-fuchsia-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                </div>
                                <div>
                                    <span className="font-semibold text-fuchsia-300 group-hover:text-fuchsia-200 transition-colors">✨ Creativity Boost (Expert Mode)</span>
                                    <span className="block text-xs text-slate-400">Allow AI to be more avant-garde.</span>
                                </div>
                            </label>
                        </div>
                        {/* Consistency Mode Toggle */}
                        <div className="p-3 bg-gradient-to-r from-lime-900/30 to-emerald-900/30 rounded-lg border border-lime-500/20">
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={consistencyMode} onChange={e => setConsistencyMode(e.target.checked)} />
                                    <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-lime-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-lime-600"></div>
                                </div>
                                <div>
                                    <span className="font-semibold text-lime-300 group-hover:text-lime-200 transition-colors">🖼️ Series Consistency (套图一致性)</span>
                                    <span className="block text-xs text-slate-400">Sync style, scene & lighting across all images.</span>
                                </div>
                            </label>
                        </div>
                        {/* NEW Sensual Mode Toggle */}
                        <div className="p-3 bg-gradient-to-r from-rose-900/30 to-red-900/30 rounded-lg border border-rose-500/20">
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={sensualMode} onChange={e => setSensualMode(e.target.checked)} />
                                    <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-rose-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-rose-300 group-hover:text-rose-200 transition-colors">🔞 Sensual Mode (诱惑/性感模式)</span>
                                        <span className="animate-pulse px-1.5 py-0.5 rounded text-[10px] bg-rose-600 text-white font-bold uppercase">HOT</span>
                                    </div>
                                    <span className="block text-xs text-slate-400">Enable boudoir aesthetics, provocative poses, and seductive lighting.</span>
                                </div>
                            </label>
                        </div>
                        {/* NEW UGC / Lo-Fi Authenticity Mode Toggle */}
                        <div className="p-3 bg-gradient-to-r from-amber-900/30 to-orange-900/30 rounded-lg border border-amber-500/20">
                            <label className="flex items-center space-x-2 cursor-pointer group">
                                <div className="relative">
                                    <input type="checkbox" className="sr-only peer" checked={ugcMode} onChange={e => setUgcMode(e.target.checked)} />
                                    <div className="w-10 h-6 bg-slate-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-amber-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">📸 Lo-Fi Authenticity (真实感/UGC)</span>
                                    </div>
                                    <span className="block text-xs text-slate-400">Add digital noise, flash, and "imperfect" amateur aesthetic for trust.</span>
                                </div>
                            </label>
                        </div>
                    </div>
                    
                    <CollapsibleSection 
                        title="Close-up Details (产品/场景特写)" 
                        isOpen={openCreativeSubAccordion === 'closeUp'} 
                        onToggle={() => setOpenCreativeSubAccordion(openCreativeSubAccordion === 'closeUp' ? '' : 'closeUp')}
                        titleClassName="text-sm font-medium text-slate-400"
                    >
                        <div className="grid grid-cols-2 gap-2">
                           {lifestyleOptions.closeUpDetails.map(item => (
                               <TagButton key={item.id} isSelected={lifestyleScene.closeUpDetails.includes(item.id)} onClick={() => handleLifestyleTagChange('closeUpDetails', item.id)}>
                                   <BilingualLabel text={item.label} />
                               </TagButton>
                           ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection 
                        title="Scene/Background (场景/背景)" 
                        isOpen={openCreativeSubAccordion === 'scene'} 
                        onToggle={() => setOpenCreativeSubAccordion(openCreativeSubAccordion === 'scene' ? '' : 'scene')}
                        titleClassName="text-sm font-medium text-slate-400"
                    >
                        <div className="grid grid-cols-2 gap-2">
                           {lifestyleOptions.scene.map(item => (
                               <TagButton key={item.id} isSelected={lifestyleScene.scene.includes(item.id)} onClick={() => handleLifestyleTagChange('scene', item.id)}>
                                   <BilingualLabel text={item.label} />
                               </TagButton>
                           ))}
                        </div>
                    </CollapsibleSection>

                    <CollapsibleSection 
                        title="Props (道具)" 
                        isOpen={openCreativeSubAccordion === 'props'} 
                        onToggle={() => setOpenCreativeSubAccordion(openCreativeSubAccordion === 'props' ? '' : 'props')}
                        titleClassName="text-sm font-medium text-slate-400"
                    >
                        <div className="grid grid-cols-2 gap-2">
                            {lifestyleOptions.props.map(item => (
                               <TagButton key={item.id} isSelected={lifestyleScene.props.includes(item.id)} onClick={() => handleLifestyleTagChange('props', item.id)}>
                                   <BilingualLabel text={item.label} />
                               </TagButton>
                            ))}
                        </div>
                        <input type="text" value={customLifestyle.props} onChange={e => handleCustomLifestyleChange('props', e.target.value)} placeholder="Custom props (自定义道具), e.g., sunglasses (太阳镜)" className="mt-2 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                    </CollapsibleSection>

                    <CollapsibleSection 
                        title="Atmosphere (氛围)" 
                        isOpen={openCreativeSubAccordion === 'atmosphere'} 
                        onToggle={() => setOpenCreativeSubAccordion(openCreativeSubAccordion === 'atmosphere' ? '' : 'atmosphere')}
                        titleClassName="text-sm font-medium text-slate-400"
                    >
                        <div className="grid grid-cols-2 gap-2">
                           {lifestyleOptions.atmosphere.map(item => (
                               <TagButton key={item.id} isSelected={lifestyleScene.atmosphere.includes(item.id)} onClick={() => handleLifestyleTagChange('atmosphere', item.id)}>
                                   <BilingualLabel text={item.label} />
                               </TagButton>
                           ))}
                        </div>
                         <input type="text" value={customLifestyle.atmosphere} onChange={e => handleCustomLifestyleChange('atmosphere', e.target.value)} placeholder="Custom atmosphere (自定义氛围), e.g., morning light (晨光)" className="mt-2 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                    </CollapsibleSection>

                    <CollapsibleSection 
                        title={<>Audience Context (受众) <span className="text-slate-500 font-normal">(Optional)</span></>} 
                        isOpen={openCreativeSubAccordion === 'audience'} 
                        onToggle={() => setOpenCreativeSubAccordion(openCreativeSubAccordion === 'audience' ? '' : 'audience')}
                        titleClassName="text-sm font-medium text-slate-400"
                    >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                           {lifestyleOptions.audience.map(item => (
                               <TagButton key={item.id} isSelected={lifestyleScene.audience.includes(item.id)} onClick={() => handleLifestyleTagChange('audience', item.id)}>
                                   <BilingualLabel text={item.label} />
                               </TagButton>
                           ))}
                        </div>
                         <input type="text" value={customLifestyle.audience} onChange={e => handleCustomLifestyleChange('audience', e.target.value)} placeholder="Custom audience details (自定义受众细节)" className="mt-2 block w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-lime-400 focus:border-lime-400" />
                    </CollapsibleSection>

                  </CollapsibleSection>

                   <CollapsibleSection title="Style Filters (风格滤镜)" isOpen={openAccordion === 'filters'} onToggle={() => setOpenAccordion(openAccordion === 'filters' ? '' : 'filters')}>
                    {styleFilters.map(category => (
                        <div key={category.category} className="mb-4 last:mb-0">
                            <h4 className="text-sm font-medium text-slate-400 mb-2">{category.category}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {category.filters.map(filter => (
                                    <TagButton
                                        key={filter.id}
                                        isSelected={selectedStyleFilter === filter.id}
                                        onClick={() => setSelectedStyleFilter(prev => prev === filter.id ? '' : filter.id)}
                                    >
                                        <div>
                                            <span className="font-semibold block text-lime-300">{filter.label}</span>
                                            <span className="text-xs text-slate-400 block font-normal">{filter.description}</span>
                                        </div>
                                    </TagButton>
                                ))}
                            </div>
                        </div>
                    ))}
                  </CollapsibleSection>

                  {generateSocialCopy && (
                    <>
                      <CollapsibleSection title="Social Media Platforms (社媒平台)" isOpen={openAccordion === 'platforms'} onToggle={() => setOpenAccordion(openAccordion === 'platforms' ? '' : 'platforms')}>
                           <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {socialPlatforms.map(item => (
                                <button 
                                    key={item.id}
                                    onClick={() => handleSocialPlatformChange(item.id)}
                                    className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all duration-200 ${
                                        selectedSocialPlatforms.includes(item.id)
                                        ? 'bg-lime-900/50 border-lime-400 text-lime-300 ring-2 ring-lime-400/50'
                                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-700/80 hover:border-slate-500'
                                    }`}
                                >
                                    {item.icon}
                                    <span className="text-xs font-semibold">{item.id}</span>
                                </button>
                              ))}
                          </div>
                      </CollapsibleSection>
                      
                      <CollapsibleSection title="Social Media Strategy (社媒策略)" isOpen={openAccordion === 'strategies'} onToggle={() => setOpenAccordion(openAccordion === 'strategies' ? '' : 'strategies')}>
                        <div className="space-y-3">
                          {socialStrategyOptions.map(item => (
                              <TagButton key={item.id} isSelected={selectedSocialStrategies.includes(item.id)} onClick={() => handleSocialStrategyChange(item.id)}>
                                  <div>
                                      <BilingualTitle text={item.label} />
                                      <span className="text-xs text-slate-400 block font-normal mt-1">{item.description}</span>
                                  </div>
                              </TagButton>
                          ))}
                        </div>
                      </CollapsibleSection>
                    </>
                  )}

                  {/* OPTIMIZED Image-to-Video Director Module */}
                  <CollapsibleSection title="🧠 Image-to-Video Director (Veo/Kling)" isOpen={openAccordion === 'videoDirector'} onToggle={() => setOpenAccordion(openAccordion === 'videoDirector' ? '' : 'videoDirector')}>
                    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700 space-y-6">
                        <div className="flex items-center gap-2 text-lime-400 font-bold mb-2">
                            <VideoIcon />
                            <span>Director Logic: Vertical Layering</span>
                        </div>
                        
                        <div className="flex flex-col gap-6">
                            {/* Camera Movement */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">1. Camera Movement (镜头运动)</label>
                                <select 
                                    value={videoPromptConfig.cameraMovement}
                                    onChange={(e) => setVideoPromptConfig(prev => ({...prev, cameraMovement: e.target.value}))}
                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-lime-500 transition-all cursor-pointer"
                                >
                                    {cameraMovements.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            {/* Action Presets */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">2. Action / Motion (动作)</label>
                                <select 
                                    value={videoPromptConfig.action}
                                    onChange={(e) => setVideoPromptConfig(prev => ({...prev, action: e.target.value}))}
                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-lime-500 transition-all cursor-pointer"
                                >
                                    <option value="">Custom / Auto (自定义 / 自动)</option>
                                    {videoActionPresets.map(preset => <option key={preset.id} value={preset.label}>{preset.label}</option>)}
                                </select>
                                {videoPromptConfig.action === "" && (
                                    <input 
                                        type="text" 
                                        placeholder="Type custom action here..."
                                        className="mt-2 w-full bg-slate-900/50 border border-slate-800 text-slate-400 text-xs rounded p-2 outline-none focus:border-lime-500"
                                        onChange={(e) => setVideoPromptConfig(prev => ({...prev, action: e.target.value}))}
                                    />
                                )}
                            </div>

                            {/* Scene Presets */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">3. Scene Override (场景覆盖)</label>
                                <select 
                                    value={videoPromptConfig.scene}
                                    onChange={(e) => setVideoPromptConfig(prev => ({...prev, scene: e.target.value}))}
                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-lime-500 transition-all cursor-pointer"
                                >
                                    <option value="">Keep Image Scene (保持图片场景)</option>
                                    {videoScenePresets.map(preset => <option key={preset.id} value={preset.label}>{preset.label}</option>)}
                                </select>
                                {videoPromptConfig.scene === "" && (
                                    <input 
                                        type="text" 
                                        placeholder="Type custom scene here..."
                                        className="mt-2 w-full bg-slate-900/50 border border-slate-800 text-slate-400 text-xs rounded p-2 outline-none focus:border-lime-500"
                                        onChange={(e) => setVideoPromptConfig(prev => ({...prev, scene: e.target.value}))}
                                    />
                                )}
                            </div>

                            {/* Visual Style */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">4. Visual Style (视觉风格)</label>
                                <select 
                                    value={videoPromptConfig.style}
                                    onChange={(e) => setVideoPromptConfig(prev => ({...prev, style: e.target.value}))}
                                    className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg p-3 outline-none focus:ring-1 focus:ring-lime-500 transition-all cursor-pointer"
                                >
                                    <option value="">Auto-Inferred (自动推断)</option>
                                    {videoStyles.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-700">
                             <label className="flex items-center gap-2 text-[10px] text-lime-300 font-bold uppercase tracking-wider mb-1">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                </svg>
                                Director Constraint: Consistency Lock
                             </label>
                             <p className="text-[10px] text-slate-500 leading-tight">
                                Subject appearance remains identical. No outfit, hair, or face changes. Lighting consistency locked.
                             </p>
                        </div>
                    </div>
                  </CollapsibleSection>

              </div>
            </div>
            
            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-4 border-b border-slate-700 pb-2 text-white">4. Presets (预设)</h2>
                <div className="space-y-4">
                    <button
                        onClick={handleSavePreset}
                        className="w-full flex items-center justify-center gap-2 bg-slate-800/60 border border-slate-700 text-slate-300 hover:bg-slate-700/80 hover:border-slate-500 font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                        Save Current Settings as Preset
                    </button>
                    {presets.length > 0 && (
                        <div>
                            <h3 className="text-base font-semibold text-slate-300 mt-4 mb-2">Load Preset</h3>
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                {presets.map(preset => (
                                    <div key={preset.name} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg">
                                        <span className="text-sm text-slate-300 truncate font-medium" title={preset.name}>{preset.name}</span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button onClick={() => handleLoadPreset(preset.name)} className="text-xs bg-lime-600 hover:bg-lime-500 text-white font-bold px-3 py-1 rounded-md transition-colors">Load</button>
                                            <button onClick={() => handleDeletePreset(preset.name)} className="p-1.5 bg-red-800/80 hover:bg-red-700/80 text-white rounded-md transition-colors" title={`Delete ${preset.name}`}>
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full mt-6 py-4 bg-gradient-to-r from-slate-300 to-slate-500 hover:from-slate-200 hover:to-slate-400 text-slate-900 font-bold text-lg rounded-xl shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin h-5 w-5 text-slate-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        GENERATE
                    </>
                )}
            </button>
            {error && (
                <div className="mt-4 p-4 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm flex items-start gap-2 animate-fade-in">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>{error}</span>
                </div>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {generatedData ? (
                <ResultsDisplay
                    data={generatedData}
                    onPerspectiveImageUpdate={handleUpdatePerspectiveImage}
                    productName={productName}
                    campaignName={campaignName}
                    videoPrompt=""
                    onExpand={handleExpandGeneration}
                    isExpanding={isExpanding}
                    onRegenerate={handleRegeneratePerspective}
                    onExtendFrame={handleExtendFrame}
                    onClearPerspectiveError={handleClearPerspectiveError}
                />
            ) : (
                <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-slate-900/40 border-2 border-dashed border-slate-700/50 rounded-2xl p-12 text-slate-500">
                     <div className="w-24 h-24 mb-6 opacity-20 bg-slate-800 rounded-full flex items-center justify-center">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                         </svg>
                    </div>
                    <p className="text-xl font-monument text-slate-400 mb-2 uppercase tracking-wide">Canvas Empty</p>
                    <p className="text-sm text-center max-w-sm text-slate-500">Configure your campaign settings on the left and hit Generate to start creating.</p>
                </div>
            )}
            
            {(isBrainstorming || isAnalyzing) && (
                 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-fade-in">
                     <Loader message={loadingMessage || (isBrainstorming ? "Brainstorming creative angles..." : isAnalyzing ? "Analyzing image structure..." : "Generating your content...")} />
                 </div>
             )}
          </div>
        </div>
      </main>
      
      <AnalysisModal 
          isOpen={isAnalysisOpen} 
          onClose={() => setIsAnalysisOpen(false)} 
          analysisText={analysisText} 
      />
    </div>
  );
};

export default App;