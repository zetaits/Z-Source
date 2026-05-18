import { Card, CardContent } from "@/components/ui/card";
import type { PickOutcome } from "@/storage/repos/pickOutcomesRepo";

interface Props {
  outcomes: PickOutcome[];
}

const formatPct = (n: number): string => `${(n * 100).toFixed(1)}%`;
const formatSigned = (n: number): string =>
  `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

export function KpiCards({ outcomes }: Props) {
  const settled = outcomes.filter((o) =>
    ["WIN", "LOSS", "PUSH"].includes(o.outcome),
  );
  const decisive = settled.filter((o) => o.outcome !== "PUSH");
  const wins = decisive.filter((o) => o.outcome === "WIN").length;
  const hitRate = decisive.length > 0 ? wins / decisive.length : 0;

  const sumStake = settled.reduce((s, o) => s + o.stakeUnits, 0);
  const sumPayout = settled.reduce(
    (s, o) => s + (o.payoutUnits ?? 0),
    0,
  );
  const roi = sumStake > 0 ? (sumPayout - sumStake) / sumStake : 0;

  const items = [
    { label: "Total picks", value: outcomes.length.toString(), tone: "neutral" },
    {
      label: "Settled",
      value: `${settled.length} / ${outcomes.length}`,
      tone: "neutral",
    },
    {
      label: "Hit rate",
      value: decisive.length > 0 ? formatPct(hitRate) : "—",
      tone: "neutral",
    },
    {
      label: "ROI",
      value: sumStake > 0 ? formatSigned(roi) : "—",
      tone: roi > 0 ? "positive" : roi < 0 ? "negative" : "neutral",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="flex flex-col gap-1 p-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {it.label}
            </span>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                it.tone === "positive"
                  ? "text-emerald-500"
                  : it.tone === "negative"
                    ? "text-rose-500"
                    : "text-foreground"
              }`}
            >
              {it.value}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
