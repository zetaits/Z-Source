import { PlusCircle } from "lucide-react";
import type { PlayCandidate } from "@/domain/play";
import { marketByKey } from "@/config/markets";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfidenceBar } from "./ConfidenceBar";
import { EVBadge } from "./EVBadge";
import { ReasoningTrace } from "./ReasoningTrace";
import { StakePill } from "./StakePill";
import { VerdictBadge } from "./VerdictBadge";

interface Props {
  play: PlayCandidate;
  onLogBet?: (play: PlayCandidate) => void;
}

const SIDE_LABEL: Record<string, string> = {
  home: "Home",
  away: "Away",
  draw: "Draw",
  over: "Over",
  under: "Under",
  yes: "Yes",
  no: "No",
};

const formatSelection = (play: PlayCandidate): string => {
  const side = SIDE_LABEL[play.selection.side] ?? play.selection.side;
  return play.selection.line !== undefined ? `${side} ${play.selection.line}` : side;
};

export function PlayCard({ play, onLogBet }: Props) {
  const marketLabel = marketByKey(play.selection.marketKey)?.label ?? play.selection.marketKey;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {play.selection.marketKey}
            </span>
            <span className="truncate text-sm font-medium">{formatSelection(play)}</span>
            <span className="truncate font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              {marketLabel}
            </span>
            <VerdictBadge verdict={play.verdict} />
          </div>
          <div className="flex flex-wrap items-center gap-4 font-mono text-xs tabular-nums">
            <Stat label="Fair" value={`${(play.fairProb * 100).toFixed(1)}%`} />
            <Stat label="Odds" value={play.price.decimal.toFixed(2)} />
            <EVBadge edgePct={play.edgePct} />
            <ConfidenceBar value={play.confidence} />
            <StakePill units={play.stakeUnits} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <ReasoningTrace entries={play.trace} />
          {onLogBet && play.stakeUnits > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onLogBet(play)}
            >
              <PlusCircle className="size-3.5" aria-hidden />
              Log this bet
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
