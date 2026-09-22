import type { RPPGProvider } from "./interfaces";

/**
 * Binah.ai Web SDK adapter.
 * SDK binaries are not on public npm — download from Binah ShareFile after
 * the license is issued. This stub keeps the swap to one line in config.ts.
 *
 * Required secret (Worker / GitHub, never committed): BINAH_LICENSE_KEY
 * Required from Beni: Web SDK zip + domain allowlist (localhost, workers.dev).
 */
export class BinahRppgProvider implements RPPGProvider {
  onBPMSample: (bpm: number, hrv: number) => void = () => {};

  startMeasurement(_videoStream: MediaStream): void {
    const key = typeof process !== "undefined" ? process.env.BINAH_LICENSE_KEY : undefined;
    if (!key) {
      throw new Error(
        "Binah Web SDK is not licensed. Set BINAH_LICENSE_KEY (Worker secret) and drop the ShareFile Web SDK into src/lib/diagnostics/binah-sdk/.",
      );
    }
    throw new Error(
      "BINAH_LICENSE_KEY is set but the private Web SDK is not in the tree yet. Copy the ShareFile package to src/lib/diagnostics/binah-sdk/ then implement HealthMonitor.createSession here.",
    );
  }

  stopMeasurement(): void {}
}
