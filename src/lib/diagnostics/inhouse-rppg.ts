import { RppgEngine } from "@/lib/rppg-engine";
import type { RPPGProvider } from "./interfaces";

/** On-device green-channel rPPG. No vendor key. Video never leaves the tab. */
export class InHouseRppgProvider implements RPPGProvider {
  private engine = new RppgEngine();
  private video: HTMLVideoElement | null = null;
  onBPMSample: (bpm: number, hrv: number) => void = () => {};

  startMeasurement(videoStream: MediaStream): void {
    this.stopMeasurement();
    let video: HTMLVideoElement | null = null;
    document.querySelectorAll("video").forEach((el) => {
      if (el.srcObject === videoStream) video = el;
    });
    if (!video) {
      video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = videoStream;
      video.play().catch(() => {});
    }
    this.video = video;
    this.engine.onPulse((p) => this.onBPMSample(p.bpm, p.hrv));
    void this.engine.start(videoStream, video);
  }

  stopMeasurement(): void {
    this.engine.stop();
    this.video = null;
  }
}
