import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { isTauri } from "./environment";
import { hostOf, limiterFor } from "./rateLimiter";
import { nextUserAgent } from "./userAgentPool";

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: BodyInit | null;
  rps?: number;
  rotateUA?: boolean;
  acceptStatus?: number[];
  signal?: AbortSignal;
  /**
   * Force WebView window.fetch even under Tauri. Use for hosts that
   * block non-browser TLS fingerprints (SofaScore, DataDome-protected
   * sites) and expose CORS headers. Renderer supplies real Chrome JA3.
   */
  preferBrowserFetch?: boolean;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers: Headers;
  ok: boolean;
  url: string;
  text(): Promise<string>;
  json(): Promise<T>;
}

const tauriEnv = isTauri();

const pickFetch = (preferBrowser: boolean) => {
  if (preferBrowser || !tauriEnv) {
    return (input: string, init?: RequestInit) => window.fetch(input, init);
  }
  return (input: string, init?: RequestInit) =>
    tauriFetch(input, init as Parameters<typeof tauriFetch>[1]);
};

export const httpRequest = async <T = unknown>(
  req: HttpRequest,
): Promise<HttpResponse<T>> => {
  const host = hostOf(req.url);
  await limiterFor(host, req.rps ?? 1).acquire();
  const headers: Record<string, string> = { ...(req.headers ?? {}) };
  if (req.rotateUA && !headers["User-Agent"]) {
    headers["User-Agent"] = nextUserAgent();
  }
  const doFetch = pickFetch(req.preferBrowserFetch === true);
  const response = await doFetch(req.url, {
    method: req.method ?? "GET",
    headers,
    body: req.body,
    signal: req.signal,
  });
  const accepted = req.acceptStatus ?? [];
  if (!response.ok && !accepted.includes(response.status)) {
    const text = await response.text().catch(() => "");
    throw new HttpError(response.status, response.url, text);
  }
  return {
    status: response.status,
    headers: response.headers,
    ok: response.ok,
    url: response.url,
    text: () => response.text(),
    json: () => response.json() as Promise<T>,
  };
};

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} ${url}`);
    this.name = "HttpError";
  }
}
