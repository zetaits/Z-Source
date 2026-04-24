import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type {
  OddsProvider,
  OddsRequestContext,
  ProviderEvent,
  QuotaSnapshot,
} from "./OddsProvider";

export interface FallbackAttempt {
  providerName: string;
  ok: boolean;
  empty: boolean;
  error?: string;
}

export interface FallbackOddsProviderOpts {
  name?: string;
  onAttempts?(attempts: FallbackAttempt[], operation: string): void;
}

const isRetryable = (err: unknown): boolean => {
  const msg = (err as Error | undefined)?.message ?? "";
  return (
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("429") ||
    msg.includes("5") ||
    msg.toLowerCase().includes("network") ||
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("not configured") ||
    msg.includes("rejected")
  );
};

export const createFallbackOddsProvider = (
  providers: OddsProvider[],
  opts: FallbackOddsProviderOpts = {},
): OddsProvider => {
  if (providers.length === 0) {
    throw new Error("FallbackOddsProvider requires at least one provider");
  }

  const attempt = async <T>(
    operation: string,
    run: (p: OddsProvider) => Promise<T>,
    isEmpty: (value: T) => boolean,
  ): Promise<T> => {
    const attempts: FallbackAttempt[] = [];
    let lastError: unknown = null;
    let lastEmpty: T | null = null;

    for (const p of providers) {
      try {
        const result = await run(p);
        if (isEmpty(result)) {
          attempts.push({ providerName: p.name, ok: true, empty: true });
          lastEmpty = result;
          continue;
        }
        attempts.push({ providerName: p.name, ok: true, empty: false });
        opts.onAttempts?.(attempts, operation);
        return result;
      } catch (err) {
        attempts.push({
          providerName: p.name,
          ok: false,
          empty: false,
          error: (err as Error).message,
        });
        lastError = err;
        if (!isRetryable(err)) {
          opts.onAttempts?.(attempts, operation);
          throw err;
        }
      }
    }

    opts.onAttempts?.(attempts, operation);
    if (lastEmpty !== null) return lastEmpty;
    if (lastError) throw lastError;
    throw new Error(`All providers exhausted for ${operation}`);
  };

  return {
    name: opts.name ?? `fallback(${providers.map((p) => p.name).join(",")})`,
    async getOdds(
      matchId: MatchId,
      markets: MarketKey[],
      context?: OddsRequestContext,
    ): Promise<LineSnapshot[]> {
      return attempt(
        "getOdds",
        (p) => p.getOdds(matchId, markets, context),
        (v) => v.length === 0,
      );
    },
    async snapshotOpeners(
      matchId: MatchId,
      context?: OddsRequestContext,
    ): Promise<LineSnapshot[]> {
      return attempt(
        "snapshotOpeners",
        (p) => p.snapshotOpeners(matchId, context),
        (v) => v.length === 0,
      );
    },
    async listEvents(sportKey: string): Promise<ProviderEvent[]> {
      return attempt(
        "listEvents",
        (p) => p.listEvents(sportKey),
        (v) => v.length === 0,
      );
    },
    quota(): QuotaSnapshot {
      return providers[0].quota();
    },
  };
};
