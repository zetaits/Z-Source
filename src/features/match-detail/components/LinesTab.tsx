import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { PlayCandidate } from "@/domain/play";
import type { SyntheticPrice } from "@/engine/synthetic";
import { OddsBoard } from "./OddsBoard";

interface Props {
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  openers: Partial<Record<MarketKey, LineSnapshot>>;
  synthetic: Partial<Record<MarketKey, SyntheticPrice[]>>;
  candidates: PlayCandidate[];
  picks: PlayCandidate[];
  homeName: string;
  awayName: string;
  ran: boolean;
}

export function LinesTab({
  lines,
  openers,
  synthetic,
  candidates,
  picks,
  homeName,
  awayName,
  ran,
}: Props) {
  if (!ran || Object.keys(lines).length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Live odds board becomes available after running analysis on this fixture.
        </p>
      </div>
    );
  }
  return (
    <OddsBoard
      lines={lines}
      openers={openers}
      synthetic={synthetic}
      candidates={candidates}
      picks={picks}
      homeName={homeName}
      awayName={awayName}
      defaultMarket="OU_GOALS"
    />
  );
}
