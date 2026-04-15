import { useMemo, useState } from "react";
import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import { LineMovementChart } from "@/components/domain/LineMovementChart";
import { useOddsHistory } from "../hooks/useOddsHistory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { marketByKey } from "@/config/markets";

const DEFAULT_MARKETS: MarketKey[] = ["ML_1X2", "OU_GOALS", "AH", "BTTS", "DNB"];

interface Props {
  matchId: MatchId | null;
}

export function LinesTab({ matchId }: Props) {
  const [market, setMarket] = useState<MarketKey>("ML_1X2");
  const { data: snapshots = [], isLoading } = useOddsHistory(matchId, market);

  const availableMarkets = useMemo(() => DEFAULT_MARKETS, []);
  const label = marketByKey(market)?.label ?? market;

  if (!matchId) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Line history becomes available after analysis resolves the OddsAPI event for this fixture.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Market</span>
        <Select value={market} onValueChange={(v) => setMarket(v as MarketKey)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableMarkets.map((k) => (
              <SelectItem key={k} value={k}>
                {marketByKey(k)?.label ?? k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
          Loading line history…
        </div>
      ) : (
        <LineMovementChart snapshots={snapshots} title={label} />
      )}
    </div>
  );
}
