import {
  TTSSimulator,
  TTSElevenLabs,
  AzureTTS,
  GoogleTTS,
  FaceAnalysisSimulator,
  RPPGSimulator,
} from "./simulators";
import type { TTSProvider, FaceAnalysisProvider, RPPGProvider } from "./interfaces";

// Single source of truth for the active TTS provider.
// Options: 'browser' | 'elevenlabs' | 'azure' | 'google'
export const TTS_PROVIDER: "browser" | "elevenlabs" | "azure" | "google" = "elevenlabs";

// Kept for backwards compatibility with older call sites.
export const USE_REAL_APIS = {
  tts: TTS_PROVIDER !== "browser",
  faceAnalysis: false, // true = Azure Face API
  rppg: false,         // true = Binah.ai
} as const;

export const AZURE_TTS_CONFIG = {
  // Required Lovable Secrets when provider = 'azure':
  //   VITE_AZURE_TTS_KEY
  //   VITE_AZURE_TTS_REGION
  voices: {
    he: "he-IL-AvriNeural",   // עברית — קול גברי טבעי
    am: "am-ET-MekdesNeural", // אמהרית — קול נשי טבעי ביותר
    ru: "ru-RU-DmitryNeural", // רוסית — קול גברי
    ku: "am-ET-MekdesNeural", // קוקי — אמהרית בינתיים
  },
  endpoint: "https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
} as const;

export const GOOGLE_TTS_CONFIG = {
  // Required Lovable Secret when provider = 'google':
  //   VITE_GOOGLE_TTS_KEY
  voices: {
    he: "he-IL-Wavenet-A",
    am: "am-ET-Standard-A",
    ru: "ru-RU-Wavenet-A",
    ku: "am-ET-Standard-A",
  },
  endpoint: "https://texttospeech.googleapis.com/v1/text:synthesize",
} as const;

export function getTTSProvider(): TTSProvider {
  switch (TTS_PROVIDER) {
    case "azure":      return new AzureTTS();
    case "google":     return new GoogleTTS();
    case "elevenlabs": return new TTSElevenLabs();
    default:           return new TTSSimulator();
  }
}

// Backwards-compatible alias used by existing callers.
export function createTTS(): TTSProvider {
  return getTTSProvider();
}

export function createFaceAnalysis(): FaceAnalysisProvider {
  if (USE_REAL_APIS.faceAnalysis) {
    // TODO: return new AzureFaceProvider();
  }
  return new FaceAnalysisSimulator();
}

export function createRPPG(): RPPGProvider {
  if (USE_REAL_APIS.rppg) {
    // TODO: return new BinahRPPGProvider();
  }
  return new RPPGSimulator();
}
