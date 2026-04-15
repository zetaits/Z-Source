import type { MarketKey } from "@/domain/market";
import type { Splits } from "@/domain/splits";
import { SentimentBar } from "@/components/domain/SentimentBar";
import { marketByKey } from "@/config/markets";

interface Props {
  splits: Partial<Record<MarketKey, Splits>>;
  homeName: string;
  awayName: string;
}

const rowLabel = (marketKey: MarketKey, side: string, homeName: string, awayName: string): string => {
  if (side === "home") return homeName;
  if (side === "away") return awayName;
  if (side === "draw") return "Draw";
  if (side === "yes") return "BTTS Yes";
  if (side === "no") return "BTTS No";
  return `${marketKey} · ${side}`;
};

export function SentimentTab({ splits, homeName, awayName }: Props) {
  const entries = Object.entries(splits) as [MarketKey, Splits][];
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        Sharp vs square sentiment needs a splits feed. Mock provider fills after Run analysis.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Sentiment is money% − bets%. Positive = sharp money leaning in; negative = public-heavy / square.
      </p>
      {entries.map(([marketKey, splits]) => {
        const descriptor = marketByKey(marketKey);
        return (
          <section key={marketKey} className="rounded-lg border bg-card p-5">
            <header className="mb-3 flex items-baseline justify-between">
              <h4 className="text-sm font-semibold">{descriptor?.label ?? marketKey}</h4>
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {splits.rows.length} sides
              </span>
            </header>
            <div className="flex flex-col gap-4">
              {splits.rows.map((row) => (
                <SentimentBar
                  key={`${marketKey}:${row.selection.side}`}
                  label={rowLabel(marketKey, row.selection.side, homeName, awayName)}
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
