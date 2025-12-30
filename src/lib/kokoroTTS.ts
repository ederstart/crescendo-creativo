// Client-side Kokoro TTS wrapper
// Uses kokoro-js for 100% browser-based TTS with local model caching

import { KokoroTTS } from 'kokoro-js';

let ttsInstance: KokoroTTS | null = null;
let isLoading = false;
let loadProgress = 0;

export type TTSVoice = 
  | 'pm_santa' | 'pf_dora' | 'pm_alex'  // pt-BR
  | 'af_heart' | 'af_bella' | 'af_sarah' | 'af_nicole' | 'am_michael' | 'am_fenrir' | 'am_adam'  // en-US
  | 'bf_emma' | 'bf_isabella' | 'bm_george' | 'bm_lewis'  // en-GB
  | 'ef_dora' | 'em_alex' | 'em_santa'  // es
  | 'jf_alpha' | 'jf_gongitsune' | 'jm_kumo'  // ja
  | 'zf_xiaobei' | 'zf_xiaoni' | 'zm_yunxi'  // zh
  | 'ff_siwis'  // fr
  | 'if_sara' | 'im_nicola'  // it
  | 'hf_alpha' | 'hm_omega';  // hi

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
      progress_callback: (progress: { progress: number }) => {
        loadProgress = Math.round(progress.progress || 0);
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
  const { voice = 'pm_santa', speed = 1, onProgress } = options;

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
