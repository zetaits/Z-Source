export interface RateLimiter {
  acquire(): Promise<void>;
}

export const createRateLimiter = (requestsPerSecond: number): RateLimiter => {
  const minIntervalMs = 1000 / Math.max(0.1, requestsPerSecond);
  let nextSlot = 0;
  return {
    async acquire() {
      const now = Date.now();
      const wait = Math.max(0, nextSlot - now);
      nextSlot = Math.max(now, nextSlot) + minIntervalMs;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    },
  };
};

const buckets = new Map<string, RateLimiter>();

export const limiterFor = (host: string, rps = 1): RateLimiter => {
  let limiter = buckets.get(host);
  if (!limiter) {
    limiter = createRateLimiter(rps);
    buckets.set(host, limiter);
  }
  return limiter;
};

export const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
};
