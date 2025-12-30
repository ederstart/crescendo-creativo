// Kokoro TTS - 100% gratuito e ilimitado
// Roda localmente no navegador usando WebAssembly
// Suporta apenas vozes em inglês (US/GB)

import { KokoroTTS } from 'kokoro-js';

let ttsInstance: KokoroTTS | null = null;
let loadingPromise: Promise<KokoroTTS> | null = null;

// Valid Kokoro voice types
export type KokoroVoiceId = 
  | 'af_alloy' | 'af_aoede' | 'af_bella' | 'af_heart' | 'af_jessica' 
  | 'af_kore' | 'af_nicole' | 'af_nova' | 'af_river' | 'af_sarah' | 'af_sky'
  | 'am_adam' | 'am_echo' | 'am_eric' | 'am_fenrir' | 'am_liam' 
  | 'am_michael' | 'am_onyx' | 'am_puck' | 'am_santa'
  | 'bf_emma' | 'bf_isabella' | 'bf_alice' | 'bf_lily'
  | 'bm_george' | 'bm_lewis' | 'bm_daniel' | 'bm_fable';

export interface KokoroVoice {
  id: KokoroVoiceId;
  name: string;
  gender: 'male' | 'female';
  quality: string;
}

export const KOKORO_VOICES: Record<string, KokoroVoice[]> = {
  'en-US': [
    { id: 'af_heart', name: 'Heart', gender: 'female', quality: 'A' },
    { id: 'af_bella', name: 'Bella', gender: 'female', quality: 'A-' },
    { id: 'af_sarah', name: 'Sarah', gender: 'female', quality: 'C+' },
    { id: 'af_nicole', name: 'Nicole', gender: 'female', quality: 'B-' },
    { id: 'af_nova', name: 'Nova', gender: 'female', quality: 'C' },
    { id: 'af_sky', name: 'Sky', gender: 'female', quality: 'C-' },
    { id: 'am_michael', name: 'Michael', gender: 'male', quality: 'C+' },
    { id: 'am_fenrir', name: 'Fenrir', gender: 'male', quality: 'C+' },
    { id: 'am_puck', name: 'Puck', gender: 'male', quality: 'C+' },
    { id: 'am_adam', name: 'Adam', gender: 'male', quality: 'F+' },
    { id: 'am_santa', name: 'Santa', gender: 'male', quality: 'D-' },
  ],
  'en-GB': [
    { id: 'bf_emma', name: 'Emma', gender: 'female', quality: 'B-' },
    { id: 'bf_isabella', name: 'Isabella', gender: 'female', quality: 'C' },
    { id: 'bf_alice', name: 'Alice', gender: 'female', quality: 'D' },
    { id: 'bf_lily', name: 'Lily', gender: 'female', quality: 'D' },
    { id: 'bm_george', name: 'George', gender: 'male', quality: 'C' },
    { id: 'bm_lewis', name: 'Lewis', gender: 'male', quality: 'D+' },
    { id: 'bm_daniel', name: 'Daniel', gender: 'male', quality: 'D' },
    { id: 'bm_fable', name: 'Fable', gender: 'male', quality: 'C' },
  ],
};

export const DEFAULT_VOICE: KokoroVoiceId = 'af_heart';
export const DEFAULT_LANGUAGE = 'en-US';

export async function getKokoroTTS(): Promise<KokoroTTS> {
  if (ttsInstance) return ttsInstance;
  
  if (loadingPromise) return loadingPromise;
  
  loadingPromise = KokoroTTS.from_pretrained(
    "onnx-community/Kokoro-82M-v1.0-ONNX",
    { dtype: "q8", device: "wasm" }
  );
  
  ttsInstance = await loadingPromise;
  return ttsInstance;
}

export function isKokoroLoaded(): boolean {
  return ttsInstance !== null;
}
