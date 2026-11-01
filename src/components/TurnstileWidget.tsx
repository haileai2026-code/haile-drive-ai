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
      s.onerror = () => { scriptPromise = null; reject(new Error("turnstile script failed")); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export const TURNSTILE_SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

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
        idRef.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "phone_otp",
          callback: (t: string) => cb.current(t),
          "expired-callback": () => cb.current(null),
          "error-callback": () => cb.current(null),
        });
      })
      .catch(() => cb.current(null));
    return () => {
      cancelled = true;
      if (idRef.current && window.turnstile) window.turnstile.remove(idRef.current);
      idRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey && idRef.current && window.turnstile) {
      window.turnstile.reset(idRef.current);
      cb.current(null);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={ref} className="flex justify-center" />;
}
