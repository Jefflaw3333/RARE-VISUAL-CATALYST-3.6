
export interface SocialPosts {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
  pinterest?: string;
  x?: string;
  blog?: string;
}

// Define ImageRef to match the expected structure in services
export interface ImageRef {
  base64: string;
  mimeType: string;
}

export interface GeneratedImage {
  src: string;
  label: string;
  description?: {
    en: string;
    cn: string;
  };
}

export interface VideoPromptConfig {
  scene: string;
  action: string;
  style: string;
  cameraMovement: string;
  composition: string;
  atmosphere: string;
}

export interface GeneratedPerspective {
  id: string;
  label: string;
  prompt: string;
  veoPrompt?: string;
  mainImage: GeneratedImage;
  socialCopy?: {
    en: string;
    cn: string;
  };
  extendedFrames?: GeneratedImage[];
  transitionText?: { en: string; cn: string };
  isExtending?: boolean;
  isRegenerating?: boolean;
  error?: string;
}

export interface GeneratedData {
  socialPosts: SocialPosts;
  perspectives: GeneratedPerspective[];
}

export interface FocusArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

// FocusImageRef uses the new ImageRef interface
export type FocusImageRef = ImageRef | null;

export type ProductInfo = {
    name: string;
    sellingPoints: string;
    link: string;
};

// Define CustomLifestyle structure
export interface CustomLifestyle {
  props: string;
  atmosphere: string;
  audience: string;
}

// Define GenerationOptions structure used during the generation process
export interface GenerationOptions {
  selectedAngles: string[];
  selectedFocusSubjects: string[]; // New: Focus subjects are now auxiliary
  generateMultiPerson: boolean;
  generateScene: boolean;
  consistencyMode: boolean;
  sensualMode: boolean;
  ugcMode: boolean; // New: Lo-Fi / UGC Authenticity Mode
  generateSocialCopy: boolean;
  creativityBoost: boolean;
  lifestyleScene: {
    scene: string[];
    props: string[];
    atmosphere: string[];
    audience: string[];
    closeUpDetails: string[];
  };
  selectedSocialPlatforms: string[];
  selectedSocialStrategies: string[];
  styleFilter: string;
  targetRegion: string; // New: Target Region
  targetAudience: string; // New: Target Audience
  aspectRatio: string;
  customDimensions: { width: number; height: number };
  imagesPerAngle: number;
  videoPromptConfig?: VideoPromptConfig;
}

export interface Preset {
  name: string;
  settings: {
    selectedAngles: string[];
    selectedProductStudioAngles: string[];
    selectedFocusSubjects: string[]; // New
    customAngles: string[];
    generateMultiPerson: boolean;
    generateScene: boolean;
    consistencyMode: boolean;
    sensualMode: boolean;
    ugcMode: boolean; // New
    lifestyleScene: {
      scene: string[];
      props: string[];
      atmosphere: string[];
      audience: string[];
      closeUpDetails: string[];
    };
    customLifestyle: {
      props: string;
      atmosphere: string;
      audience: string;
    };
    targetRegion: string; // New
    targetAudience: string; // New
    selectedSocialStrategies: string[];
    selectedSocialPlatforms: string[];
    selectedStyleFilter: string;
    referenceImages: string[];
    aspectRatio: string;
    customDimensions: { width: number; height: number };
    imagesPerAngle: number;
    videoPromptConfig?: VideoPromptConfig;
  };
}
