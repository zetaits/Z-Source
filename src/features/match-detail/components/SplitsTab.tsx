import type { MarketKey } from "@/domain/market";
import type { LineSnapshot } from "@/domain/odds";
import type { Splits } from "@/domain/splits";
import { marketByKey } from "@/config/markets";
import { cn } from "@/lib/utils";

interface Props {
  splits: Partial<Record<MarketKey, Splits>>;
  lines: Partial<Record<MarketKey, LineSnapshot>>;
  homeName: string;
  awayName: string;
}

const sideLabel = (
  marketKey: MarketKey,
  side: string,
  homeName: string,
  awayName: string,
): string => {
  if (side === "home") return homeName;
  if (side === "away") return awayName;
  if (side === "draw") return "Draw";
  if (side === "yes") return marketKey === "BTTS" ? "BTTS Yes" : "Yes";
  if (side === "no") return marketKey === "BTTS" ? "BTTS No" : "No";
  return side;
};

const matchesSide = (
  offerSide: string,
  wantedSide: string,
  line: number | undefined,
  offerLine: number | undefined,
): boolean => {
  if (offerSide !== wantedSide) return false;
  if (line === undefined && offerLine === undefined) return true;
  if (line === undefined || offerLine === undefined) return false;
  return Math.abs(line - offerLine) < 1e-9;
};

const bestDecimalFor = (
  snap: LineSnapshot | undefined,
  side: string,
  line?: number,
): number | null => {
  if (!snap) return null;
  let best: number | null = null;
  for (const o of snap.offers) {
    if (!matchesSide(o.selection.side, side, line, o.selection.line)) continue;
    if (best === null || o.decimal > best) best = o.decimal;
  }
  return best;
};

const fmtPct = (n: number | undefined): string =>
  typeof n === "number" && Number.isFinite(n) ? `${Math.round(n)}%` : "—";

const fmtDec = (n: number | null): string =>
  n === null ? "—" : n.toFixed(2);

export function SplitsTab({ splits, lines, homeName, awayName }: Props) {
  const entries = Object.entries(splits) as [MarketKey, Splits][];
  if (entries.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        No splits data for this fixture.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Money</span> is the best decimal price across
        books. <span className="font-medium text-foreground">Handle</span> is the share of dollar
        volume on that side; <span className="font-medium text-foreground">Bets</span> is the share
        of bet count. Handle ≫ Bets (big positive Δ) hints at sharp money; Handle ≪ Bets hints at
        public squares.
      </p>
      {entries.map(([marketKey, s]) => {
        const descriptor = marketByKey(marketKey);
        const snap = lines[marketKey];
        const totalBets = s.rows.reduce((acc, r) => acc + (r.betsPct ?? 0), 0);
        const totalMoney = s.rows.reduce((acc, r) => acc + (r.moneyPct ?? 0), 0);
        return (
          <section key={marketKey} className="rounded-lg border bg-card">
            <header className="flex items-baseline justify-between border-b border-border/60 px-5 py-3">
              <div className="flex items-baseline gap-3">
                <h4 className="text-sm font-semibold">{descriptor?.label ?? marketKey}</h4>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.rows.length} sides · Σbets {Math.round(totalBets)}% · Σhandle {Math.round(totalMoney)}%
                </span>
              </div>
              <div
                className="flex items-center gap-1.5"
                title={
                  s.bookId
                    ? `Splits sourced via ${s.source}; percentages reflect action at ${s.bookId}.`
                    : `Splits sourced via ${s.source}.`
                }
              >
                <span className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.source}
                </span>
                {s.bookId && (
                  <span className="rounded border border-border/60 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.bookId}
                  </span>
                )}
              </div>
            </header>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-2 text-left font-medium">Side</th>
                  <th className="px-5 py-2 text-right font-medium">Money</th>
                  <th className="px-5 py-2 text-right font-medium">Handle</th>
                  <th className="px-5 py-2 text-right font-medium">Bets</th>
                  <th className="px-5 py-2 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((row) => {
                  const dec = bestDecimalFor(snap, row.selection.side, row.selection.line);
                  const hasBoth =
                    typeof row.betsPct === "number" && typeof row.moneyPct === "number";
                  const delta = hasBoth ? row.moneyPct! - row.betsPct! : undefined;
                  const deltaTone =
                    delta === undefined
                      ? "text-muted-foreground"
                      : delta >= 15
                        ? "text-success"
                        : delta <= -15
                          ? "text-destructive"
                          : "text-muted-foreground";
                  return (
                    <tr
                      key={`${row.selection.side}:${row.selection.line ?? ""}`}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="px-5 py-3 font-medium">
                        {sideLabel(marketKey, row.selection.side, homeName, awayName)}
                        {row.selection.line !== undefined && (
                          <span className="ml-1 font-mono text-xs text-muted-foreground">
                            {row.selection.line > 0 ? "+" : ""}
                            {row.selection.line}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {fmtDec(dec)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {fmtPct(row.moneyPct)}
                      </td>
                      <td className="px-5 py-3 text-right font-mono tabular-nums">
                        {fmtPct(row.betsPct)}
                      </td>
                      <td
                        className={cn(
                          "px-5 py-3 text-right font-mono tabular-nums",
                          deltaTone,
                        )}
                      >
                        {delta === undefined
                          ? "—"
                          : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}
