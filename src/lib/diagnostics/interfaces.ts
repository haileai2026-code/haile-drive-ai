// Pluggable interfaces for diagnostics subsystems.
// Swap a single line in config.ts to switch implementation
// (e.g. simulator → Google TTS / Azure Face / Binah.ai).

export type DiagLanguage = "he" | "am" | "ru" | "ku";

export interface TTSProvider {
  speak(text: string, language: DiagLanguage): Promise<void>;
  stop(): void;
}

export interface FaceEmotion {
  anxiety: number;     // 0-1
  focus: number;       // 0-1
  confusion: number;   // 0-1
  confidence: number;  // 0-1
  timestamp: number;
}

export interface FaceAnalysisProvider {
  startAnalysis(videoStream: MediaStream): void;
  stopAnalysis(): void;
  onEmotionDetected: (emotion: FaceEmotion) => void;
}

export interface RPPGProvider {
  startMeasurement(videoStream: MediaStream): void;
  stopMeasurement(): void;
  onBPMSample: (bpm: number, hrv: number) => void;
}
