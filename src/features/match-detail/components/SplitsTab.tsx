import type { MarketKey } from "@/domain/market";
import type { Splits } from "@/domain/splits";
import { SplitGauge } from "@/components/domain/SplitGauge";
import { marketByKey } from "@/config/markets";

interface Props {
  splits: Partial<Record<MarketKey, Splits>>;
  homeName: string;
  awayName: string;
}

const sideLabel = (marketKey: MarketKey, side: string, homeName: string, awayName: string): string => {
  if (side === "home") return homeName;
  if (side === "away") return awayName;
  if (side === "draw") return "Draw";
  if (side === "yes") return marketKey === "BTTS" ? "BTTS Yes" : "Yes";
  if (side === "no") return marketKey === "BTTS" ? "BTTS No" : "No";
  return side;
};

export function SplitsTab({ splits, homeName, awayName }: Props) {
  const entries = Object.entries(splits) as [MarketKey, Splits][];
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        No splits data. Mock provider covers 1X2, DNB and BTTS after Run analysis.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Mock deterministic splits. "Tickets" is public bet count %, "Money" is handle %. Delta ≥ +15Δ
        hints at sharp backing; ≤ −15Δ hints at square money.
      </p>
      {entries.map(([marketKey, splits]) => {
        const descriptor = marketByKey(marketKey);
        return (
          <section key={marketKey} className="rounded-lg border bg-card p-5">
            <header className="mb-3 flex items-baseline justify-between">
              <h4 className="text-sm font-semibold">{descriptor?.label ?? marketKey}</h4>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {splits.source}
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {splits.rows.map((row) => (
                <SplitGauge
                  key={`${marketKey}:${row.selection.side}`}
                  label={sideLabel(marketKey, row.selection.side, homeName, awayName)}
                  betsPct={row.betsPct}
                  moneyPct={row.moneyPct}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
