import type {
  TTSProvider,
  FaceAnalysisProvider,
  FaceEmotion,
  RPPGProvider,
  DiagLanguage,
} from "./interfaces";
import { ttsElevenLabs } from "@/lib/tts.functions";
import { AZURE_TTS_CONFIG, GOOGLE_TTS_CONFIG } from "./config";

// --- TTS via ElevenLabs (server function) -------------------------------
export class TTSElevenLabs implements TTSProvider {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;

  async speak(text: string, language: DiagLanguage): Promise<void> {
    this.stop();
    try {
      const res = await ttsElevenLabs({ data: { text, language } });
      if (res.error || !res.audio) {
        // Fallback to Web Speech if ElevenLabs fails
        return new TTSSimulator().speak(text, language);
      }
      const url = `data:audio/mpeg;base64,${res.audio}`;
      const a = new Audio(url);
      this.audio = a;
      this.currentUrl = url;
      await a.play();
    } catch (e) {
      console.warn("ElevenLabs TTS failed, falling back", e);
      return new TTSSimulator().speak(text, language);
    }
  }

  stop(): void {
    if (this.audio) {
      try { this.audio.pause(); } catch {}
      this.audio = null;
    }
    this.currentUrl = null;
  }
}

// --- TTS using built-in Web Speech API (free, in-browser) ----------------
export class TTSSimulator implements TTSProvider {
  async speak(text: string, language: DiagLanguage): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang =
        language === "am" ? "am-ET" :
        language === "ru" ? "ru-RU" :
        language === "ku" ? "he-IL" : // fallback (no Kuki voice)
        "he-IL";
      u.rate = 0.85;
      u.pitch = 1.0;
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn("TTS failed", e);
    }
  }
  stop(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }
}

// --- Face Analysis (simulated; swap with Azure Face API later) ----------
export class FaceAnalysisSimulator implements FaceAnalysisProvider {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  onEmotionDetected: (emotion: FaceEmotion) => void = () => {};

  startAnalysis(_stream: MediaStream): void {
    this.stopAnalysis();
    let t = 0;
    this.intervalId = setInterval(() => {
      t += 1;
      // light drift so the meters look alive
      const anxiety = Math.max(0, Math.min(1, 0.2 + Math.sin(t / 7) * 0.25 + Math.random() * 0.2));
      const focus = Math.max(0, Math.min(1, 0.7 + Math.cos(t / 5) * 0.15 + (Math.random() - 0.5) * 0.1));
      const confusion = Math.max(0, Math.min(1, 0.15 + Math.random() * 0.3));
      const confidence = Math.max(0, Math.min(1, 0.6 + Math.cos(t / 6) * 0.2 + (Math.random() - 0.5) * 0.1));
      this.onEmotionDetected({ anxiety, focus, confusion, confidence, timestamp: Date.now() });
    }, 1500);
  }

  stopAnalysis(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// --- rPPG (simulated; swap with Binah.ai later) -------------------------
export class RPPGSimulator implements RPPGProvider {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private bpm = 72;
  onBPMSample: (bpm: number, hrv: number) => void = () => {};

  startMeasurement(_stream: MediaStream): void {
    this.stopMeasurement();
    this.bpm = 70 + Math.random() * 6;
    this.intervalId = setInterval(() => {
      this.bpm += (Math.random() - 0.5) * 6;
      this.bpm = Math.max(60, Math.min(110, this.bpm));
      const hrv = 25 + Math.random() * 30;
      this.onBPMSample(Math.round(this.bpm), Math.round(hrv));
    }, 1000);
  }

  stopMeasurement(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
