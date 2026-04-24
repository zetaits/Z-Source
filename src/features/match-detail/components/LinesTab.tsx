import { useMemo, useState } from "react";
import type { MatchId } from "@/domain/ids";
import type { MarketKey } from "@/domain/market";
import {
  LineMovementChart,
  pickAutoBucketMs,
} from "@/components/domain/LineMovementChart";
import { useOddsHistory } from "../hooks/useOddsHistory";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { marketByKey } from "@/config/markets";

const DEFAULT_MARKETS: MarketKey[] = ["ML_1X2", "OU_GOALS", "AH", "BTTS", "DNB"];

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

type BucketChoice = "auto" | "15m" | "30m" | "1h" | "3h" | "6h" | "12h";

const BUCKET_MS: Record<Exclude<BucketChoice, "auto">, number> = {
  "15m": 15 * MIN,
  "30m": 30 * MIN,
  "1h": HOUR,
  "3h": 3 * HOUR,
  "6h": 6 * HOUR,
  "12h": 12 * HOUR,
};

const BUCKET_LABEL: Record<BucketChoice, string> = {
  auto: "Auto",
  "15m": "15 min",
  "30m": "30 min",
  "1h": "1 hour",
  "3h": "3 hours",
  "6h": "6 hours",
  "12h": "12 hours",
};

const formatBucket = (ms: number): string => {
  if (ms < HOUR) return `${Math.round(ms / MIN)}m`;
  return `${Math.round(ms / HOUR)}h`;
};

interface Props {
  matchId: MatchId | null;
}

export function LinesTab({ matchId }: Props) {
  const [market, setMarket] = useState<MarketKey>("ML_1X2");
  const [bucket, setBucket] = useState<BucketChoice>("auto");
  const { data: snapshots = [], isLoading } = useOddsHistory(matchId, market);

  const availableMarkets = useMemo(() => DEFAULT_MARKETS, []);
  const label = marketByKey(market)?.label ?? market;

  const effectiveBucketMs = useMemo(
    () => (bucket === "auto" ? pickAutoBucketMs(snapshots) : BUCKET_MS[bucket]),
    [bucket, snapshots],
  );

  const chartTitle = useMemo(() => {
    const parts = [label, `${formatBucket(effectiveBucketMs)} buckets`];
    if (bucket === "auto") parts[1] += " · auto";
    parts.push(`${snapshots.length} snapshots`);
    return parts.join(" · ");
  }, [label, effectiveBucketMs, bucket, snapshots.length]);

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
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Market
          </span>
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

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Bucket
          </span>
          <Select value={bucket} onValueChange={(v) => setBucket(v as BucketChoice)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BUCKET_LABEL) as BucketChoice[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {BUCKET_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
          Loading line history…
        </div>
      ) : (
        <LineMovementChart
          snapshots={snapshots}
          title={chartTitle}
          bucketMs={effectiveBucketMs}
        />
      )}
    </div>
  );
}
