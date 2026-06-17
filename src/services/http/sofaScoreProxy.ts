import { emit, listen } from "@tauri-apps/api/event";

// Bridge to the hidden `sofa-proxy` webview (created in Rust, parked on
// sofascore.com). SofaScore sits behind DataDome, which challenges any request
// that doesn't originate from a cleared sofascore.com browsing context. We
// forward each API URL to that webview, where the fetch runs same-site with the
// clearance cookie + Referer, and stream the response back over Tauri events.

export interface ProxyResult {
  status: number;
  body: string;
}

interface Pending {
  resolve: (r: ProxyResult) => void;
  timer: ReturnType<typeof setTimeout>;
  poller: ReturnType<typeof setInterval>;
}

const PROXY_TIMEOUT_MS = 20_000;
// Tauri events aren't buffered: a request emitted before the bridge's listener
// is installed (webview still loading/solving the challenge) is simply lost.
// Re-emit on an interval until a response arrives or the timeout fires.
const PROXY_REEMIT_MS = 2_000;

const pending = new Map<string, Pending>();
let wired = false;
let ready = false;
let counter = 0;

const ensureWired = async (): Promise<void> => {
  if (wired) return;
  wired = true;
  await listen<{ id: string; status: number; body: string }>("sofa-fetch-res", (e) => {
    const p = pending.get(e.payload.id);
    if (!p) return;
    clearTimeout(p.timer);
    clearInterval(p.poller);
    pending.delete(e.payload.id);
    p.resolve({ status: e.payload.status, body: e.payload.body });
  });
  await listen("sofa-proxy-ready", () => {
    ready = true;
  });
};

/**
 * Fetch a SofaScore URL through the proxy webview. Resolves with the raw status
 * and body; rejects on timeout (caller treats that as "no data" and degrades).
 */
export const proxyFetch = async (url: string, signal?: AbortSignal): Promise<ProxyResult> => {
  await ensureWired();
  const id = `sf-${Date.now()}-${counter++}`;
  return new Promise<ProxyResult>((resolve, reject) => {
    const send = () => void emit("sofa-fetch-req", { id, url });
    const cleanup = () => {
      clearTimeout(timer);
      clearInterval(poller);
      pending.delete(id);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`sofa-proxy timeout after ${PROXY_TIMEOUT_MS}ms`));
    }, PROXY_TIMEOUT_MS);
    const poller = setInterval(send, PROXY_REEMIT_MS);
    if (signal) {
      if (signal.aborted) {
        cleanup();
        reject(new Error("aborted"));
        return;
      }
      signal.addEventListener(
        "abort",
        () => {
          cleanup();
          reject(new Error("aborted"));
        },
        { once: true },
      );
    }
    pending.set(id, { resolve, timer, poller });
    send();
  });
};

export const isProxyReady = (): boolean => ready;
