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

  // SofaScore is behind DataDome and only serves requests from a cleared
  // sofascore.com context. Under Tauri, route through the hidden proxy webview
  // (lazy import keeps the Tauri event API out of browser/test builds).
  if (tauriEnv && /(^|\.)sofascore\.com$/.test(host)) {
    const accepted = req.acceptStatus ?? [];
    const { proxyFetch } = await import("./sofaScoreProxy");
    const { status, body } = await proxyFetch(req.url, req.signal);
    if (status !== 200 && !accepted.includes(status)) {
      throw new HttpError(status, req.url, body);
    }
    return {
      status,
      headers: new Headers(),
      ok: status >= 200 && status < 300,
      url: req.url,
      text: async () => body,
      json: async () => JSON.parse(body) as T,
    };
  }

  const headers: Record<string, string> = { ...(req.headers ?? {}) };
  if (req.rotateUA && !headers["User-Agent"]) {
    headers["User-Agent"] = nextUserAgent();
  }
  const useBrowser = req.preferBrowserFetch === true;
  const doFetch = pickFetch(useBrowser);
  if (!useBrowser && tauriEnv) {
    headers["Origin"] = "";
  }
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

const SENSITIVE_QUERY_KEYS = new Set([
  "apikey",
  "api_key",
  "key",
  "token",
  "access_token",
  "secret",
]);

/**
 * Mask credential-bearing query params so URLs are safe to put in error
 * messages and logs. Several providers (e.g. odds-api.io) pass the API key as a
 * query param; without this it would leak into HttpError.message, console
 * warnings and any toast surfacing the error.
 */
export const redactUrl = (raw: string): string => {
  try {
    const u = new URL(raw);
    for (const k of u.searchParams.keys()) {
      if (SENSITIVE_QUERY_KEYS.has(k.toLowerCase())) u.searchParams.set(k, "***");
    }
    return u.toString();
  } catch {
    return raw;
  }
};

export class HttpError extends Error {
  public readonly url: string;
  constructor(
    public readonly status: number,
    url: string,
    public readonly body: string,
  ) {
    super(`HTTP ${status} ${redactUrl(url)}`);
    this.name = "HttpError";
    this.url = redactUrl(url);
  }
}
