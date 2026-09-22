import {
  TTSSimulator,
  TTSElevenLabs,
  AzureTTS,
  GoogleTTS,
  FaceAnalysisSimulator,
} from "./simulators";
import { InHouseRppgProvider } from "./inhouse-rppg";
import type { TTSProvider, FaceAnalysisProvider, RPPGProvider } from "./interfaces";

export type TTSProviderName = "browser" | "elevenlabs" | "azure" | "google";
export const TTS_PROVIDER: TTSProviderName = "elevenlabs";

export const USE_REAL_APIS = {
  tts: (TTS_PROVIDER as TTSProviderName) !== "browser",
  faceAnalysis: false,
  rppg: true,
} as const;

export const AZURE_TTS_CONFIG = {
  voices: {
    he: "he-IL-AvriNeural",
    am: "am-ET-MekdesNeural",
    ru: "ru-RU-DmitryNeural",
    ku: "am-ET-MekdesNeural",
  },
  endpoint: "https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
} as const;

export const GOOGLE_TTS_CONFIG = {
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
    case "azure":
      return new AzureTTS();
    case "google":
      return new GoogleTTS();
    case "elevenlabs":
      return new TTSElevenLabs();
    default:
      return new TTSSimulator();
  }
}

export function createTTS(): TTSProvider {
  return getTTSProvider();
}

export function createFaceAnalysis(): FaceAnalysisProvider {
  return new FaceAnalysisSimulator();
}

/** POC: always in-house on-device rPPG. Binah stub stays unused. */
export function createRPPG(): RPPGProvider {
  return new InHouseRppgProvider();
}
