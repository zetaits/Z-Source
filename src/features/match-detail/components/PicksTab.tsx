import type { PlayCandidate } from "@/domain/play";
import { PlayCard } from "@/components/domain/PlayCard";

interface Props {
  plays: PlayCandidate[];
  onLogBet: (play: PlayCandidate) => void;
  ran: boolean;
  status: string;
  message?: string;
}

export function PicksTab({ plays, onLogBet, ran, status, message }: Props) {
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
      <div className="rounded-lg border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          No plays cleared the threshold on this fixture. Loosen the stake policy in Strategy to see marginal plays.
        </p>
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
