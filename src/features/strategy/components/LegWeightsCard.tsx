import { useEffect, useState } from "react";
import { Scale } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import type { Leg, LegWeights } from "@/domain/strategy";
import { DEFAULT_LEG_WEIGHTS } from "@/domain/strategy";

interface Props {
  weights: LegWeights;
  disabled?: boolean;
  onChange(weights: LegWeights): void;
}

const LEGS: { key: keyof LegWeights; label: string; hint: string }[] = [
  { key: "matchup", label: "Matchup", hint: "Head-to-head quality, form-vs-form." },
  { key: "trends", label: "Trends", hint: "Directional history and tempo cues." },
  { key: "lines", label: "Lines", hint: "Line value, draws, structural mispricing." },
  {
    key: "sharpVsSquare",
    label: "Sharp vs Square",
    hint: "Money flow, reverse line movement, public fades.",
  },
  {
    key: "intangibles",
    label: "Intangibles",
    hint: "Rest, congestion, motivation, absences.",
  },
];

export function LegWeightsCard({ weights, disabled, onChange }: Props) {
  const [local, setLocal] = useState<LegWeights>(weights);

  useEffect(() => {
    setLocal(weights);
  }, [weights]);

  const commit = (leg: Leg & keyof LegWeights, value: number) => {
    const next = { ...local, [leg]: value };
    setLocal(next);
    onChange(next);
  };

  const total = LEGS.reduce((s, l) => s + local[l.key], 0);
  const balanced = Math.abs(total - 1) <= 0.01;

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Scale className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div className="flex-1">
          <h2 className="text-sm font-semibold">Leg weights (Bonded)</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            How much each of the five Bonded legs contributes to the fair-prob shift. Weights are
            relative — they don&apos;t have to sum to 1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`font-tabular text-[11px] ${
              balanced ? "text-muted-foreground" : "text-warning"
            }`}
          >
            Σ {total.toFixed(2)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={disabled}
            onClick={() => {
              setLocal(DEFAULT_LEG_WEIGHTS);
              onChange(DEFAULT_LEG_WEIGHTS);
            }}
          >
            Reset
          </Button>
        </div>
      </header>

      <div className="grid gap-4">
        {LEGS.map((leg) => {
          const v = local[leg.key];
          return (
            <div key={leg.key} className="grid gap-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{leg.label}</span>
                <span className="font-tabular text-xs text-muted-foreground">
                  {v.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[v]}
                min={0}
                max={1}
                step={0.05}
                disabled={disabled}
                onValueChange={([next]) => commit(leg.key, next)}
                aria-label={`${leg.label} weight`}
              />
              <span className="text-[11px] text-muted-foreground">{leg.hint}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
