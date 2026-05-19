import { useEffect, useState } from "react";
import { Block } from "@/components/zs";
import { DEFAULT_STAKE_POLICY, type StakeKind, type StakePolicy } from "@/domain/strategy";

interface Props {
  policy: StakePolicy;
  disabled?: boolean;
  onChange(policy: StakePolicy): void;
}

const captionStyle = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--zs-fg-muted)" } as const;
const legendStyle = { fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--zs-fg-muted)", display: "flex", justifyContent: "space-between", marginTop: 6 } as const;
const bignumWrap = { display: "flex", alignItems: "baseline", gap: 6, marginTop: 8, marginBottom: 10 } as const;

const withDefaults = (p: StakePolicy): StakePolicy => ({ ...DEFAULT_STAKE_POLICY, ...p });

export function StakePolicyCard({ policy, disabled, onChange }: Props) {
  const [local, setLocal] = useState<StakePolicy>(() => withDefaults(policy));

  useEffect(() => {
    setLocal(withDefaults(policy));
  }, [policy]);

  const commit = (patch: Partial<StakePolicy>) => {
    const next = { ...local, ...patch };
    setLocal(next);
    onChange(next);
  };

  const isKelly = local.kind === "FRACTIONAL_KELLY";
  const setKind = (kind: StakeKind) => commit({ kind });

  return (
    <Block head="STAKE POLICY · FRACTIONAL KELLY">
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        <button
          type="button"
          disabled={disabled}
          className={`zs-btn sm ${isKelly ? "primary" : "ghost"}`}
          onClick={() => setKind("FRACTIONAL_KELLY")}
        >
          KELLY
        </button>
        <button
          type="button"
          disabled={disabled}
          className={`zs-btn sm ${!isKelly ? "primary" : "ghost"}`}
          onClick={() => setKind("FLAT")}
        >
          FLAT
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22 }}>
        {isKelly ? (
          <div>
            <div style={captionStyle}>KELLY FRACTION</div>
            <div style={bignumWrap}>
              <span className="zs-bignum amber" style={{ fontSize: 38 }}>{local.kellyFraction.toFixed(2)}</span>
              <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>×K</span>
            </div>
            <input
              id="stake-kelly-fraction"
              type="range"
              className="zs-slider"
              min={0.05}
              max={1}
              step={0.05}
              value={local.kellyFraction}
              disabled={disabled}
              onChange={(e) => commit({ kellyFraction: Number(e.target.value) })}
            />
            <div style={legendStyle}><span>0.05</span><span>1.00</span></div>
          </div>
        ) : (
          <div>
            <div style={captionStyle}>FLAT UNITS</div>
            <div style={bignumWrap}>
              <span className="zs-bignum amber" style={{ fontSize: 38 }}>{local.flatUnits.toFixed(2)}</span>
              <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>u</span>
            </div>
            <input
              id="stake-flat-units"
              type="range"
              className="zs-slider"
              min={0.25}
              max={10}
              step={0.25}
              value={local.flatUnits}
              disabled={disabled}
              onChange={(e) => commit({ flatUnits: Number(e.target.value) })}
            />
            <div style={legendStyle}><span>0.25</span><span>10.00</span></div>
          </div>
        )}

        <div>
          <div style={captionStyle}>MAX UNITS / PLAY</div>
          <div style={bignumWrap}>
            <span className="zs-bignum amber" style={{ fontSize: 38 }}>{local.maxUnitsPerPlay.toFixed(1)}</span>
            <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>u</span>
          </div>
          <input
            id="stake-max-units"
            type="range"
            className="zs-slider"
            min={0.5}
            max={10}
            step={0.5}
            value={local.maxUnitsPerPlay}
            disabled={disabled}
            onChange={(e) => commit({ maxUnitsPerPlay: Number(e.target.value) })}
          />
          <div style={legendStyle}><span>0.5</span><span>10.0</span></div>
        </div>

        <div>
          <div style={captionStyle}>MIN EDGE</div>
          <div style={bignumWrap}>
            <span className="zs-bignum amber" style={{ fontSize: 38 }}>{(local.minEdgePct * 100).toFixed(1)}</span>
            <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>%</span>
          </div>
          <input
            id="stake-min-edge"
            type="range"
            className="zs-slider"
            min={0}
            max={20}
            step={0.5}
            value={+(local.minEdgePct * 100).toFixed(1)}
            disabled={disabled}
            onChange={(e) => commit({ minEdgePct: Number(e.target.value) / 100 })}
          />
          <div style={legendStyle}><span>0%</span><span>20%</span></div>
        </div>
      </div>

      <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--zs-rule)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <div>
          <div style={captionStyle}>MIN CONFIDENCE</div>
          <div style={bignumWrap}>
            <span className="zs-bignum amber" style={{ fontSize: 30 }}>{local.minConfidence.toFixed(2)}</span>
            <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>0–1</span>
          </div>
          <input
            id="stake-min-confidence"
            type="range"
            className="zs-slider"
            min={0}
            max={1}
            step={0.05}
            value={local.minConfidence}
            disabled={disabled}
            onChange={(e) => commit({ minConfidence: Number(e.target.value) })}
          />
          <div style={legendStyle}><span>0.00</span><span>1.00</span></div>
        </div>

        <div>
          <div style={captionStyle}>UNBONDED FACTOR</div>
          <div style={bignumWrap}>
            <span className="zs-bignum amber" style={{ fontSize: 30 }}>{local.unbondedFactor.toFixed(2)}</span>
            <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>×stake</span>
          </div>
          <input
            type="range"
            className="zs-slider"
            min={0}
            max={1}
            step={0.05}
            value={local.unbondedFactor}
            disabled={disabled}
            onChange={(e) => commit({ unbondedFactor: Number(e.target.value) })}
          />
          <div style={legendStyle}><span>0.00</span><span>1.00</span></div>
        </div>
      </div>
    </Block>
  );
}
