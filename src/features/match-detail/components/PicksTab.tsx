import type { PlayCandidate } from "@/domain/play";
import { PlayCard } from "@/components/domain/PlayCard";
import type { AnalysisDiagnostics } from "@/engine";
import { DiagnosticsCard } from "./DiagnosticsCard";
import { NearMissesCard } from "./NearMissesCard";

interface Props {
  plays: PlayCandidate[];
  allCandidates?: PlayCandidate[];
  onLogBet: (play: PlayCandidate) => void;
  ran: boolean;
  status: string;
  message?: string;
  diagnostics?: AnalysisDiagnostics;
}

export function PicksTab({
  plays,
  allCandidates,
  onLogBet,
  ran,
  status,
  message,
  diagnostics,
}: Props) {
  if (!ran) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Click <span className="font-medium text-foreground">Run analysis</span> to evaluate this fixture.
        </p>
      </div>
    );
  }
  if (status !== "ok" && plays.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          {status === "no-api-key"
            ? "Configure your OddsAPI key in Settings to unlock analysis."
            : status === "unresolved"
              ? (message ?? "No OddsAPI event matched this fixture.")
              : status === "empty-odds"
                ? "OddsAPI returned no odds for this fixture."
                : message || "Analysis unavailable."}
        </p>
      </div>
    );
  }
  if (plays.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No plays cleared the threshold on this fixture.
          </p>
        </div>
        {diagnostics ? <DiagnosticsCard diagnostics={diagnostics} /> : null}
        {allCandidates && allCandidates.length > 0 ? (
          <NearMissesCard candidates={allCandidates} />
        ) : null}
      </div>
    );
  }
  // Prop sports (e.g. baseball pitcher Ks) carry selection.player — group the
  // plays under a per-player heading. Football plays have no player, so the
  // grouping collapses to the original flat list (byte-identical render).
  const hasPlayers = plays.some((p) => p.selection.player);
  if (!hasPlayers) {
    return (
      <div className="flex flex-col gap-3">
        {plays.map((p) => (
          <PlayCard key={p.id} play={p} onLogBet={onLogBet} />
        ))}
      </div>
    );
  }

  const groups = groupByPlayer(plays);
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([player, group]) => (
        <div key={player} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold">{player}</span>
            {group[0]?.selection.propLabel ? (
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {group[0].selection.propLabel}
              </span>
            ) : null}
          </div>
          {group.map((p) => (
            <PlayCard key={p.id} play={p} onLogBet={onLogBet} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Stable grouping of plays by selection.player, preserving first-seen order. */
function groupByPlayer(plays: PlayCandidate[]): [string, PlayCandidate[]][] {
  const order: string[] = [];
  const byPlayer = new Map<string, PlayCandidate[]>();
  for (const p of plays) {
    const key = p.selection.player ?? "—";
    if (!byPlayer.has(key)) {
      byPlayer.set(key, []);
      order.push(key);
    }
    byPlayer.get(key)!.push(p);
  }
  return order.map((k) => [k, byPlayer.get(k)!]);
}
