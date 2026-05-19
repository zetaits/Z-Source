import { useEffect, useState } from "react";
import { Block } from "@/components/zs";
import type { Leg, LegWeights } from "@/domain/strategy";
import { DEFAULT_LEG_WEIGHTS } from "@/domain/strategy";

interface Props {
  weights: LegWeights;
  disabled?: boolean;
  onChange(weights: LegWeights): void;
  /** Min positive legs to flag a pick as "bonded". Optional — defaults locally. */
  minLegsAlignedForBonded?: number;
  onMinLegsChange?(n: number): void;
}

const LEGS: { key: keyof LegWeights; label: string }[] = [
  { key: "matchup", label: "MATCHUP" },
  { key: "trends", label: "TRENDS" },
  { key: "lines", label: "LINES" },
  { key: "sharpVsSquare", label: "SHARP·SQUARE" },
  { key: "intangibles", label: "INTANGIBLES" },
];

const captionStyle = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--zs-fg-muted)" } as const;
const valueStyle = { fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18, color: "var(--zs-accent)", fontVariantNumeric: "tabular-nums" } as const;

const withDefaults = (w: LegWeights): LegWeights => ({ ...DEFAULT_LEG_WEIGHTS, ...w });

export function LegWeightsCard({ weights, disabled, onChange, minLegsAlignedForBonded = 3, onMinLegsChange }: Props) {
  const [local, setLocal] = useState<LegWeights>(() => withDefaults(weights));

  useEffect(() => {
    setLocal(withDefaults(weights));
  }, [weights]);

  const commit = (leg: Leg & keyof LegWeights, value: number) => {
    const next = { ...local, [leg]: value };
    setLocal(next);
    onChange(next);
  };

  const total = LEGS.reduce((s, l) => s + local[l.key], 0);
  const balanced = Math.abs(total - 1) <= 0.01;

  return (
    <Block
      head="LEG WEIGHTS · BONDED COMBINATOR"
      headRight={
        <>
          <span style={{ ...captionStyle, color: balanced ? "var(--zs-fg-muted)" : "var(--zs-accent)" }}>
            Σ {total.toFixed(2)}
          </span>
          <button
            type="button"
            className="zs-btn sm ghost"
            disabled={disabled}
            onClick={() => {
              setLocal(DEFAULT_LEG_WEIGHTS);
              onChange(DEFAULT_LEG_WEIGHTS);
            }}
          >
            RESET
          </button>
        </>
      }
    >
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-muted)", margin: "0 0 16px" }}>
        Relative pull each leg has on the fair-prob shift. Weights are normalized at runtime — they don&apos;t need to sum to 1.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14 }}>
        {LEGS.map((leg) => {
          const v = local[leg.key];
          const pct = Math.round(v * 100);
          return (
            <div key={leg.key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={captionStyle}>{leg.label}</span>
                <span style={valueStyle}>{v.toFixed(2)}</span>
              </div>
              <input
                type="range"
                className="zs-slider"
                min={0}
                max={1}
                step={0.05}
                value={v}
                disabled={disabled}
                onChange={(e) => commit(leg.key as Leg & keyof LegWeights, Number(e.target.value))}
                aria-label={`${leg.label} weight`}
              />
              <div className="zs-bar tall" style={{ marginTop: 8 }}>
                <span style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--zs-rule)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={captionStyle}>BONDED FLOOR · MIN POS LEGS</span>
        <div style={{ display: "flex", gap: 6 }}>
          {[2, 3, 4, 5].map((n) => {
            const active = minLegsAlignedForBonded === n;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled || !onMinLegsChange}
                onClick={() => onMinLegsChange?.(n)}
                className="zs-btn sm"
                style={
                  active
                    ? { background: "var(--zs-accent)", color: "var(--zs-bg)", borderColor: "var(--zs-accent)", fontWeight: 700 }
                    : undefined
                }
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>
    </Block>
  );
}
