import { TTSSimulator, FaceAnalysisSimulator, RPPGSimulator } from "./simulators";
import type { TTSProvider, FaceAnalysisProvider, RPPGProvider } from "./interfaces";

// Flip to true once a real SDK is wired in. Single source of truth.
export const USE_REAL_APIS = {
  tts: false,          // true = Google TTS
  faceAnalysis: false, // true = Azure Face API
  rppg: false,         // true = Binah.ai
} as const;

export function createTTS(): TTSProvider {
  if (USE_REAL_APIS.tts) {
    // TODO: return new GoogleTTSProvider();
  }
  return new TTSSimulator();
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
