// HB-01: Cloudflare Turnstile widget (explicit render). Site key comes from
// VITE_TURNSTILE_SITE_KEY (public). The token is verified server-side.
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("turnstile script failed"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

type TurnstileApi = NonNullable<Window["turnstile"]>;

/** Render options; expired/error null the token so the send button disables. */
export function turnstileRenderOptions(sitekey: string, onToken: (t: string | null) => void) {
  return {
    sitekey,
    action: "phone_otp",
    callback: (t: string) => onToken(t),
    "expired-callback": () => onToken(null),
    "error-callback": () => onToken(null),
  };
}

/** On a new resetKey: reset the widget and drop the (single-use) token. */
export function applyTurnstileReset(
  resetKey: number | undefined,
  id: string | null,
  api: TurnstileApi | undefined,
  onToken: (t: string | null) => void,
): boolean {
  if (!resetKey || !id || !api) return false;
  api.reset(id);
  onToken(null);
  return true;
}

/** Send-code button is disabled while busy or while there is no token. */
export function sendOtpDisabled(busy: boolean, token: string | null): boolean {
  return busy || !token;
}

export const TURNSTILE_SITE_KEY: string =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

export function TurnstileWidget({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const idRef = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        idRef.current = window.turnstile.render(
          ref.current,
          turnstileRenderOptions(TURNSTILE_SITE_KEY, (t) => cb.current(t)),
        );
      })
      .catch(() => cb.current(null));
    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current);
      idRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyTurnstileReset(resetKey, idRef.current, window.turnstile, (t) => cb.current(t));
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
