// Placeholder rPPG SDK — מדמה NuraLogix/Binah.ai
// בעתיד יוחלף בקריאה אמיתית ל-SDK שמנתח פיקסלים מהמצלמה ומחזיר BPM/HRV.

export type BiometricSample = {
  bpm: number;
  hrv: number;
  timestamp: number;
};

export type RppgListener = (sample: BiometricSample) => void;

export class RppgSimulator {
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<RppgListener>();
  private mode: "rest" | "stress" = "rest";
  private stream: MediaStream | null = null;

  async start(stream: MediaStream) {
    this.stream = stream;
    if (this.timer) return;
    // דגימה כל שניה — מדמה זרם רציף מה-SDK
    this.timer = setInterval(() => {
      const baseBpm = this.mode === "rest" ? 72 : 95;
      const jitter = (Math.random() - 0.5) * 8;
      const sample: BiometricSample = {
        bpm: Math.round((baseBpm + jitter) * 10) / 10,
        hrv: Math.round((this.mode === "rest" ? 55 : 32) + (Math.random() - 0.5) * 10),
        timestamp: Date.now(),
      };
      this.listeners.forEach((l) => l(sample));
    }, 1000);
  }

  setMode(mode: "rest" | "stress") {
    this.mode = mode;
  }

  onSample(listener: RppgListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.listeners.clear();
  }
}
