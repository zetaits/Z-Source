import { useQuery } from "@tanstack/react-query";
import type { Bet } from "@/domain/bet";
import { MatchId } from "@/domain/ids";
import { isPersistentStorage } from "@/storage";
import { snapshotsRepo } from "@/storage/repos/snapshotsRepo";
import {
  isPropBet,
  parsePropSelectionKey,
  type PropLineSnapshot,
} from "../clvSummary";

/**
 * Load the persisted PITCHER_KS line snapshots for the matches of the given
 * prop bets, parsed into the pure {@link PropLineSnapshot} shape and keyed by
 * bet id. This is what lets the CLV report measure the line-move and
 * model-vs-close axes (not just odds CLV). One listForMatch call per distinct
 * match; bets in the same match share the parsed rows. Returns an empty map on
 * web/test builds (no persistent storage) — the report degrades to odds-only.
 */
export const useClvSnapshots = (bets: Bet[]) => {
  const propBets = bets.filter(isPropBet);
  const matchIds = Array.from(new Set(propBets.map((b) => String(b.matchId)))).sort();

  return useQuery({
    queryKey: ["clv", "snapshots", matchIds] as const,
    enabled: isPersistentStorage() && propBets.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, PropLineSnapshot[]>> => {
      // Parse each match's Ks snapshots once (oldest→newest preserved by the
      // repo's ORDER BY taken_at ASC, which the latest-wins helpers rely on).
      const byMatch = new Map<string, PropLineSnapshot[]>();
      await Promise.all(
        matchIds.map(async (mid) => {
          const rows = await snapshotsRepo
            .listForMatch(MatchId(mid), "PITCHER_KS")
            .catch(() => []);
          const parsed: PropLineSnapshot[] = [];
          for (const r of rows) {
            const sel = parsePropSelectionKey(r.selectionKey);
            if (!sel) continue;
            parsed.push({
              side: sel.side,
              line: sel.line,
              priceDecimal: r.priceDecimal,
              player: sel.player,
            });
          }
          byMatch.set(mid, parsed);
        }),
      );

      const out: Record<string, PropLineSnapshot[]> = {};
      for (const b of propBets) {
        out[String(b.id)] = byMatch.get(String(b.matchId)) ?? [];
      }
      return out;
    },
  });
};
