// Client-side Kokoro TTS wrapper
// Uses kokoro-js for 100% browser-based TTS with local model caching

import { KokoroTTS } from 'kokoro-js';

let ttsInstance: KokoroTTS | null = null;
let isLoading = false;
let loadProgress = 0;

// Kokoro-js only supports English voices (American and British)
export type TTSVoice = 
  // American English
  | 'af_heart' | 'af_alloy' | 'af_aoede' | 'af_bella' | 'af_jessica' | 'af_kore' 
  | 'af_nicole' | 'af_nova' | 'af_river' | 'af_sarah' | 'af_sky'
  | 'am_adam' | 'am_echo' | 'am_eric' | 'am_fenrir' | 'am_liam' | 'am_michael' | 'am_onyx' | 'am_puck' | 'am_santa'
  // British English
  | 'bf_alice' | 'bf_emma' | 'bf_isabella' | 'bf_lily'
  | 'bm_daniel' | 'bm_fable' | 'bm_george' | 'bm_lewis';

export interface GenerateOptions {
  voice?: TTSVoice;
  speed?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Initialize the Kokoro TTS model
 * Downloads and caches model locally (~80MB with q8)
 */
export async function initKokoro(onProgress?: (progress: number) => void): Promise<KokoroTTS> {
  if (ttsInstance) return ttsInstance;
  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress?.(loadProgress);
    }
    if (ttsInstance) return ttsInstance;
  }

  isLoading = true;
  loadProgress = 0;

  try {
    console.log('[Kokoro TTS] Initializing model...');
    
    ttsInstance = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
      dtype: 'q8', // Smaller model (~80MB), good quality
      device: 'wasm', // Maximum browser compatibility
      progress_callback: (progress) => {
        // Handle different progress info types
        if ('progress' in progress && typeof progress.progress === 'number') {
          loadProgress = Math.round(progress.progress);
        } else if ('status' in progress) {
          // DoneProgressInfo or other status types
          if (progress.status === 'done') {
            loadProgress = 100;
          }
        }
        onProgress?.(loadProgress);
        console.log(`[Kokoro TTS] Loading: ${loadProgress}%`);
      },
    });

    console.log('[Kokoro TTS] Model loaded successfully!');
    loadProgress = 100;
    onProgress?.(100);
    
    return ttsInstance;
  } catch (error) {
    console.error('[Kokoro TTS] Failed to initialize:', error);
    ttsInstance = null;
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Generate speech from text
 * Returns a Blob with the audio data
 */
export async function generateSpeech(
  text: string,
  options: GenerateOptions = {}
): Promise<Blob> {
  const { voice = 'af_heart', speed = 1, onProgress } = options;

  // Initialize if needed
  const tts = await initKokoro(onProgress);

  console.log(`[Kokoro TTS] Generating speech: voice=${voice}, speed=${speed}, text length=${text.length}`);

  // Generate audio
  const audio = await tts.generate(text, {
    voice,
    speed,
  });

  // Convert RawAudio to WAV blob
  const wavData = audio.toWav();
  const blob = new Blob([wavData], { type: 'audio/wav' });

  console.log(`[Kokoro TTS] Audio generated: ${blob.size} bytes`);
  
  return blob;
}

/**
 * Check if model is loaded
 */
export function isModelLoaded(): boolean {
  return ttsInstance !== null;
}

/**
 * Check if model is currently loading
 */
export function isModelLoading(): boolean {
  return isLoading;
}

/**
 * Get current loading progress
 */
export function getLoadProgress(): number {
  return loadProgress;
}

/**
 * Check if model is already cached in browser storage
 */
export async function checkModelCached(): Promise<boolean> {
  // If already loaded in memory, it's cached
  if (ttsInstance) return true;
  
  try {
    // Check if exists in IndexedDB (where transformers.js stores models)
    const databases = await indexedDB.databases();
    const hasTransformersDB = databases.some(db => 
      db.name?.includes('transformers') || db.name?.includes('onnx')
    );
    
    if (!hasTransformersDB) return false;
    
    // Try to open the cache to check for Kokoro files
    const cache = await caches.open('transformers-cache');
    const keys = await cache.keys();
    const hasKokoroFiles = keys.some(req => 
      req.url.includes('Kokoro-82M') || req.url.includes('kokoro')
    );
    
    return hasKokoroFiles;
  } catch (error) {
    console.log('[Kokoro TTS] Cache check failed:', error);
    return false;
  }
}
