import { useEffect, useState } from "react";
import { Block } from "@/components/zs";
import { DEFAULT_COMBO_POLICY } from "@/domain/strategy";
import type { ComboPolicy } from "@/domain/strategy";
import { isPersistentStorage } from "@/storage";
import { settingsRepo } from "@/storage/repos/settingsRepo";

const K_COMBO_POLICY = "strategy.comboPolicy";

const loadComboPolicy = async (): Promise<ComboPolicy> => {
  if (!isPersistentStorage()) return DEFAULT_COMBO_POLICY;
  const saved = await settingsRepo.get<ComboPolicy>(K_COMBO_POLICY);
  if (!saved) return DEFAULT_COMBO_POLICY;
  return { ...DEFAULT_COMBO_POLICY, ...saved };
};

const saveComboPolicy = async (p: ComboPolicy): Promise<void> => {
  if (!isPersistentStorage()) return;
  await settingsRepo.set(K_COMBO_POLICY, p);
};

const captionStyle = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--zs-fg-muted)" } as const;
const legendStyle = { fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--zs-fg-muted)", display: "flex", justifyContent: "space-between", marginTop: 6 } as const;
const bignumWrap = { display: "flex", alignItems: "baseline", gap: 6, marginTop: 8, marginBottom: 10 } as const;

export function ComboPolicyCard() {
  const [policy, setPolicy] = useState<ComboPolicy>(DEFAULT_COMBO_POLICY);

  useEffect(() => {
    loadComboPolicy().then(setPolicy).catch(() => {});
  }, []);

  const update = async (patch: Partial<ComboPolicy>) => {
    const next = { ...policy, ...patch };
    setPolicy(next);
    await saveComboPolicy(next).catch(() => {});
  };

  return (
    <Block
      head="COMBO POLICY · MIN BAR"
      headRight={
        <span
          role="switch"
          aria-checked={policy.enabled}
          className={`zs-toggle ${policy.enabled ? "on" : ""}`}
          onClick={() => void update({ enabled: !policy.enabled })}
        />
      }
    >
      {!policy.enabled ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--zs-fg-muted)" }}>
          DISABLED · combos no se filtran. Anchor-mode and per-leg combos run untouched.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 22 }}>
          <div>
            <div style={captionStyle}>MIN ODDS</div>
            <div style={bignumWrap}>
              <span className="zs-bignum amber" style={{ fontSize: 38 }}>{policy.minCombinedDecimal.toFixed(2)}</span>
              <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>dec</span>
            </div>
            <input
              type="range"
              className="zs-slider"
              min={1.1}
              max={5}
              step={0.05}
              value={policy.minCombinedDecimal}
              onChange={(e) => void update({ minCombinedDecimal: Number(e.target.value) })}
            />
            <div style={legendStyle}><span>1.10</span><span>5.00</span></div>
          </div>

          <div>
            <div style={captionStyle}>MIN EDGE</div>
            <div style={bignumWrap}>
              <span className="zs-bignum amber" style={{ fontSize: 38 }}>{(policy.minCombinedEdge * 100).toFixed(1)}</span>
              <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>%</span>
            </div>
            <input
              type="range"
              className="zs-slider"
              min={1}
              max={20}
              step={0.5}
              value={+(policy.minCombinedEdge * 100).toFixed(1)}
              onChange={(e) => void update({ minCombinedEdge: Number(e.target.value) / 100 })}
            />
            <div style={legendStyle}><span>1%</span><span>20%</span></div>
          </div>

          <div>
            <div style={captionStyle}>MIN FAIR PROB</div>
            <div style={bignumWrap}>
              <span className="zs-bignum amber" style={{ fontSize: 38 }}>{(policy.minCombinedFairProb * 100).toFixed(0)}</span>
              <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>%</span>
            </div>
            <input
              type="range"
              className="zs-slider"
              min={20}
              max={80}
              step={1}
              value={+(policy.minCombinedFairProb * 100).toFixed(0)}
              onChange={(e) => void update({ minCombinedFairProb: Number(e.target.value) / 100 })}
            />
            <div style={legendStyle}><span>20%</span><span>80%</span></div>
          </div>
        </div>
      )}
    </Block>
  );
}
