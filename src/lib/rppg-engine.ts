// Real rPPG Engine — מעבד פריימים מהמצלמה ומחלץ דופק אמיתי
// טכניקה: Photoplethysmography (PPG) דרך ערוץ ירוק (G) של ROI מרכזי בפנים.
// מזהה peaks → BPM, מחשב HRV (RMSSD) מ-R-R intervals.

export type PulseEvent = {
  timestamp: number;
  bpm: number;
  hrv: number; // RMSSD ב-ms
  rrIntervalMs: number;
  signalQuality: SignalQuality;
};

export type SignalSnapshot = {
  bpm: number | null;
  hrv: number | null;
  signalQuality: SignalQuality;
  faceDetected: boolean;
  fps: number;
  meanGreen: number | null;
  brightness: number | null;
  skinRatio: number;
  motion: number | null;
  samplesInWindow: number;
};

export type SignalQuality = "none" | "low" | "medium" | "high";

type SampleListener = (snap: SignalSnapshot) => void;
type PulseListener = (pulse: PulseEvent) => void;

const WINDOW_SECONDS = 10; // חלון ניתוח
const TARGET_FPS = 30;
const MIN_RR_MS = 400; // דופק מקסימלי 150
const MAX_RR_MS = 1500; // דופק מינימלי 40
const ROI_RATIO = 0.25; // 25% מרכזי של הפריים

export class RppgEngine {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private rafId: number | null = null;
  private stream: MediaStream | null = null;

  // אות גולמי
  private samples: { t: number; g: number; brightness: number }[] = [];
  private rrIntervals: number[] = []; // ms
  private peakTimestamps: number[] = []; // ms
  private lastFrameAt = 0;
  private lastMeanG: number | null = null;
  private fpsTicks: number[] = [];

  private sampleListeners = new Set<SampleListener>();
  private pulseListeners = new Set<PulseListener>();

  private snapshot: SignalSnapshot = {
    bpm: null,
    hrv: null,
    signalQuality: "none",
    faceDetected: false,
    fps: 0,
    meanGreen: null,
    brightness: null,
    skinRatio: 0,
    motion: null,
    samplesInWindow: 0,
  };

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 80;
    this.canvas.height = 60;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  async start(stream: MediaStream, video: HTMLVideoElement) {
    this.stream = stream;
    this.video = video;
    this.samples = [];
    this.rrIntervals = [];
    this.peakTimestamps = [];
    this.lastFrameAt = 0;
    this.lastMeanG = null;
    this.fpsTicks = [];
    this.loop();
  }

  stop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video = null;
    this.sampleListeners.clear();
    this.pulseListeners.clear();
  }

  onSample(listener: SampleListener) {
    this.sampleListeners.add(listener);
    return () => this.sampleListeners.delete(listener);
  }

  onPulse(listener: PulseListener) {
    this.pulseListeners.add(listener);
    return () => this.pulseListeners.delete(listener);
  }

  getSnapshot(): SignalSnapshot {
    return this.snapshot;
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop);
    const frameNow = performance.now();
    if (frameNow - this.lastFrameAt < 1000 / TARGET_FPS) return;
    this.lastFrameAt = frameNow;

    const v = this.video;
    if (!v || !this.ctx || v.readyState < 2) return;

    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) return;

    // ROI מרכזי (אזור פנים/מצח משוער)
    const roiW = w * ROI_RATIO;
    const roiH = h * ROI_RATIO;
    const sx = (w - roiW) / 2;
    const sy = h * 0.3 - roiH / 2; // קצת מעל המרכז (מצח)

    try {
      this.ctx.drawImage(
        v,
        sx,
        Math.max(0, sy),
        roiW,
        roiH,
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      const img = this.ctx.getImageData(
        0,
        0,
        this.canvas.width,
        this.canvas.height,
      );
      const { meanG, brightness, skinRatio } = analyzePixels(img.data);
      const t = frameNow;
      const motion = this.lastMeanG === null ? 0 : Math.abs(meanG - this.lastMeanG);
      this.lastMeanG = meanG;
      this.fpsTicks.push(t);
      const fpsCutoff = t - 1000;
      while (this.fpsTicks.length && this.fpsTicks[0] < fpsCutoff) this.fpsTicks.shift();

      this.samples.push({ t, g: meanG, brightness });
      // שמור רק את חלון הניתוח האחרון
      const cutoff = t - WINDOW_SECONDS * 1000;
      while (this.samples.length && this.samples[0].t < cutoff) {
        this.samples.shift();
      }

      const faceDetected = brightness > 30 && brightness < 230 && skinRatio > 0.12 && motion < 8;

      // עיבוד DSP — צריך לפחות 3 שניות נתונים
      if (this.samples.length > TARGET_FPS * 3 && faceDetected) {
        this.detectPeaks(t);
      } else if (!faceDetected) {
        this.snapshot = {
          bpm: null,
          hrv: null,
          signalQuality: "none",
          faceDetected: false,
          fps: this.fpsTicks.length,
          meanGreen: meanG,
          brightness,
          skinRatio,
          motion,
          samplesInWindow: this.samples.length,
        };
      }

      this.snapshot = {
        ...this.snapshot,
        faceDetected,
        fps: this.fpsTicks.length,
        meanGreen: meanG,
        brightness,
        skinRatio,
        motion,
        samplesInWindow: this.samples.length,
      };
      this.sampleListeners.forEach((l) => l(this.snapshot));
    } catch {
      // התעלם מפריימים פגומים
    }
  };

  private detectPeaks(now: number) {
    // 1. detrend — חיסור ממוצע נע
    const values = this.samples.map((s) => s.g);
    const ma = movingAverage(values, Math.round(TARGET_FPS * 0.6));
    const detrended = values.map((v, i) => v - ma[i]);

    // 2. נרמול
    const std = standardDeviation(detrended);
    if (std < 0.05) {
      // אות חלש מדי
      this.updateQuality("low");
      return;
    }
    const normalized = detrended.map((v) => v / std);

    // 3. peak detection — מקומיים שעוברים סף
    const peaks: { t: number; v: number }[] = [];
    const threshold = 0.5;
    for (let i = 2; i < normalized.length - 2; i++) {
      const v = normalized[i];
      if (
        v > threshold &&
        v > normalized[i - 1] &&
        v > normalized[i - 2] &&
        v > normalized[i + 1] &&
        v > normalized[i + 2]
      ) {
        peaks.push({ t: this.samples[i].t, v });
      }
    }

    // 4. מצא peaks חדשים שעוד לא דווחו
    for (const p of peaks) {
      const lastReported = this.peakTimestamps[this.peakTimestamps.length - 1];
      if (!lastReported || p.t - lastReported > MIN_RR_MS) {
        if (lastReported) {
          const rr = p.t - lastReported;
          if (rr >= MIN_RR_MS && rr <= MAX_RR_MS) {
            this.rrIntervals.push(rr);
            // השאר רק 30 RR אחרונים
            if (this.rrIntervals.length > 30) this.rrIntervals.shift();

            const bpm = Math.round(60000 / rr);
            const hrv = computeRMSSD(this.rrIntervals);
            const quality = this.assessQuality();

            this.snapshot = {
              bpm,
              hrv: Math.round(hrv),
              signalQuality: quality,
              faceDetected: true,
            };

            const event: PulseEvent = {
              timestamp: p.t,
              bpm,
              hrv: Math.round(hrv),
              rrIntervalMs: Math.round(rr),
              signalQuality: quality,
            };
            this.pulseListeners.forEach((l) => l(event));
          }
        }
        this.peakTimestamps.push(p.t);
        if (this.peakTimestamps.length > 30) this.peakTimestamps.shift();
      }
    }

    // נקה peaks ישנים מהחלון
    const cutoff = now - WINDOW_SECONDS * 1000;
    while (this.peakTimestamps.length && this.peakTimestamps[0] < cutoff) {
      this.peakTimestamps.shift();
    }
  }

  private updateQuality(q: SignalQuality) {
    this.snapshot = { ...this.snapshot, signalQuality: q };
  }

  private assessQuality(): SignalQuality {
    const n = this.rrIntervals.length;
    if (n < 3) return "low";
    // עקביות RR — אם השונות גבוהה מדי האות רועש
    const mean = this.rrIntervals.reduce((a, b) => a + b, 0) / n;
    const variance =
      this.rrIntervals.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const cv = Math.sqrt(variance) / mean; // coefficient of variation

    if (n >= 8 && cv < 0.15) return "high";
    if (n >= 5 && cv < 0.25) return "medium";
    return "low";
  }
}

// ---------- DSP utils ----------

function analyzePixels(data: Uint8ClampedArray) {
  let sumG = 0;
  let sumBrightness = 0;
  let skinPixels = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    sumG += g;
    sumBrightness += (r + g + b) / 3;
    // היוריסטיקה גסה לזיהוי גוון עור
    if (r > 60 && g > 40 && b > 20 && r > b && r - g > 5 && r < 250) {
      skinPixels++;
    }
  }
  return {
    meanG: sumG / total,
    brightness: sumBrightness / total,
    skinRatio: skinPixels / total,
  };
}

function movingAverage(arr: number[], window: number): number[] {
  const out: number[] = new Array(arr.length);
  let sum = 0;
  const half = Math.floor(window / 2);
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - half);
    const end = Math.min(arr.length, i + half + 1);
    sum = 0;
    for (let j = start; j < end; j++) sum += arr[j];
    out[i] = sum / (end - start);
  }
  return out;
}

function standardDeviation(arr: number[]): number {
  if (!arr.length) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const v = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}

// RMSSD = sqrt(mean(diff(RR)^2)) — מדד HRV סטנדרטי
function computeRMSSD(rrs: number[]): number {
  if (rrs.length < 2) return 0;
  let sumSq = 0;
  for (let i = 1; i < rrs.length; i++) {
    const d = rrs[i] - rrs[i - 1];
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (rrs.length - 1));
}
