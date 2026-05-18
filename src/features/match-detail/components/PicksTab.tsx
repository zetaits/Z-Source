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
  return (
    <div className="flex flex-col gap-3">
      {plays.map((p) => (
        <PlayCard key={p.id} play={p} onLogBet={onLogBet} />
      ))}
    </div>
  );
}
