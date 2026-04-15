import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { StakeKind, StakePolicy } from "@/domain/strategy";

interface Props {
  policy: StakePolicy;
  disabled?: boolean;
  onChange(policy: StakePolicy): void;
}

const parseNumber = (raw: string, fallback: number): number => {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

export function StakePolicyCard({ policy, disabled, onChange }: Props) {
  const [local, setLocal] = useState<StakePolicy>(policy);

  useEffect(() => {
    setLocal(policy);
  }, [policy]);

  const commit = (patch: Partial<StakePolicy>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  const isKelly = local.kind === "FRACTIONAL_KELLY";

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Coins className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Stake policy</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            How stake size is derived for plays that clear the threshold. Units are defined in Bankroll.
          </p>
        </div>
      </header>

      <div className="grid gap-5">
        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Sizing mode
          </Label>
          <RadioGroup
            value={local.kind}
            onValueChange={(v) => commit({ kind: v as StakeKind })}
            disabled={disabled}
            className="grid gap-2 sm:grid-cols-2"
          >
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-sm transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="FRACTIONAL_KELLY" className="mt-1" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Fractional Kelly</span>
                <span className="text-xs text-muted-foreground">
                  Kelly × fraction, scaled by confidence, capped.
                </span>
              </div>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-sm transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <RadioGroupItem value="FLAT" className="mt-1" />
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">Flat</span>
                <span className="text-xs text-muted-foreground">
                  Fixed units regardless of edge.
                </span>
              </div>
            </label>
          </RadioGroup>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {isKelly ? (
            <div className="grid gap-2">
              <Label
                htmlFor="stake-kelly-fraction"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Kelly fraction
              </Label>
              <Input
                id="stake-kelly-fraction"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={local.kellyFraction}
                disabled={disabled}
                onChange={(e) =>
                  commit({ kellyFraction: parseNumber(e.target.value, local.kellyFraction) })
                }
                className="font-tabular"
              />
              <p className="text-[11px] text-muted-foreground">
                0.25 is conservative · 1.0 is full Kelly.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label
                htmlFor="stake-flat-units"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Flat units
              </Label>
              <Input
                id="stake-flat-units"
                type="number"
                min={0}
                step={0.25}
                value={local.flatUnits}
                disabled={disabled}
                onChange={(e) =>
                  commit({ flatUnits: parseNumber(e.target.value, local.flatUnits) })
                }
                className="font-tabular"
              />
              <p className="text-[11px] text-muted-foreground">
                Units placed on every qualifying play.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label
              htmlFor="stake-max-units"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Max units / play
            </Label>
            <Input
              id="stake-max-units"
              type="number"
              min={0}
              step={0.5}
              value={local.maxUnitsPerPlay}
              disabled={disabled}
              onChange={(e) =>
                commit({ maxUnitsPerPlay: parseNumber(e.target.value, local.maxUnitsPerPlay) })
              }
              className="font-tabular"
            />
            <p className="text-[11px] text-muted-foreground">
              Safety cap on any single play.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label
              htmlFor="stake-min-edge"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Min edge %
            </Label>
            <Input
              id="stake-min-edge"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={(local.minEdgePct * 100).toFixed(1)}
              disabled={disabled}
              onChange={(e) =>
                commit({ minEdgePct: parseNumber(e.target.value, local.minEdgePct * 100) / 100 })
              }
              className="font-tabular"
            />
            <p className="text-[11px] text-muted-foreground">
              Plays below this EV% are sized to 0 units.
            </p>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="stake-min-confidence"
              className="text-xs uppercase tracking-wider text-muted-foreground"
            >
              Min confidence
            </Label>
            <Input
              id="stake-min-confidence"
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={local.minConfidence}
              disabled={disabled}
              onChange={(e) =>
                commit({ minConfidence: parseNumber(e.target.value, local.minConfidence) })
              }
              className="font-tabular"
            />
            <p className="text-[11px] text-muted-foreground">
              0 to 1. High confidence = low leg disagreement.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
