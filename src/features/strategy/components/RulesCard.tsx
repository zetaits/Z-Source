import { useEffect, useState } from "react";
import { Puzzle } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Leg, RuleConfig } from "@/domain/strategy";
import { RULES } from "@/engine/rules";
import type { Rule } from "@/engine/types";

interface Props {
  rules: RuleConfig[];
  disabled?: boolean;
  onChange(row: RuleConfig): void;
}

const LEG_LABELS: Record<Leg, string> = {
  matchup: "Matchup",
  trends: "Trends",
  lines: "Lines",
  sharpVsSquare: "Sharp vs Square",
  intangibles: "Intangibles",
  math: "Math",
};

const LEG_TONE: Record<Leg, string> = {
  matchup: "bg-primary/10 text-primary",
  trends: "bg-success/15 text-success",
  lines: "bg-accent/40 text-accent-foreground",
  sharpVsSquare: "bg-warning/15 text-warning",
  intangibles: "bg-muted text-muted-foreground",
  math: "bg-secondary text-secondary-foreground",
};

interface RuleRowProps {
  rule: Rule;
  config: RuleConfig;
  disabled?: boolean;
  onChange(row: RuleConfig): void;
}

const RuleRow = ({ rule, config, disabled, onChange }: RuleRowProps) => {
  const [weight, setWeight] = useState(config.weight);
  const [enabled, setEnabled] = useState(config.enabled);

  useEffect(() => {
    setWeight(config.weight);
    setEnabled(config.enabled);
  }, [config.weight, config.enabled]);

  const commitEnabled = (next: boolean) => {
    setEnabled(next);
    onChange({ ...config, enabled: next, weight });
  };

  const commitWeight = (next: number) => {
    setWeight(next);
    onChange({ ...config, weight: next, enabled });
  };

  const markets = rule.markets === "*" ? ["ALL"] : rule.markets;

  return (
    <div className="grid gap-3 rounded-md border border-border bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{rule.id}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                LEG_TONE[rule.leg]
              }`}
            >
              {LEG_LABELS[rule.leg]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{rule.description}</p>
        </div>
        <Switch
          checked={enabled}
          disabled={disabled}
          onCheckedChange={commitEnabled}
          aria-label={`Enable ${rule.id}`}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {markets.map((m) => (
          <span
            key={m}
            className="rounded border border-border/80 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            {m}
          </span>
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Weight
          </span>
          <span className="font-tabular text-xs text-muted-foreground">
            {weight.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[weight]}
          min={0}
          max={2}
          step={0.05}
          disabled={disabled || !enabled}
          onValueChange={([v]) => commitWeight(v)}
          aria-label={`${rule.id} weight`}
        />
      </div>
    </div>
  );
};

export function RulesCard({ rules, disabled, onChange }: Props) {
  const byId = new Map(rules.map((r) => [r.ruleId, r]));

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Puzzle className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Rules</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Toggle and weight the rules that feed the Bonded legs. Disabled rules skip evaluation
            entirely; weight scales their pull on the fair-prob shift.
          </p>
        </div>
      </header>

      <div className="grid gap-3">
        {RULES.map((rule) => {
          const config: RuleConfig = byId.get(rule.id) ?? {
            ruleId: rule.id,
            enabled: true,
            weight: rule.defaultWeight,
          };
          return (
            <RuleRow
              key={rule.id}
              rule={rule}
              config={config}
              disabled={disabled}
              onChange={onChange}
            />
          );
        })}
      </div>
    </section>
  );
}
