import { useEffect, useState } from "react";
import { DEFAULT_COMBO_POLICY } from "@/domain/strategy";
import type { ComboPolicy } from "@/domain/strategy";
import { isPersistentStorage } from "@/storage";
import { settingsRepo } from "@/storage/repos/settingsRepo";

const K_COMBO_POLICY = "strategy.comboPolicy";

const loadComboPolicy = async (): Promise<ComboPolicy> => {
  if (!isPersistentStorage()) return DEFAULT_COMBO_POLICY;
  const saved = await settingsRepo.get<ComboPolicy>(K_COMBO_POLICY);
  return saved ?? DEFAULT_COMBO_POLICY;
};

const saveComboPolicy = async (p: ComboPolicy): Promise<void> => {
  if (!isPersistentStorage()) return;
  await settingsRepo.set(K_COMBO_POLICY, p);
};

export function StrategyCard() {
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
    <div
      className="flex flex-col gap-4 rounded-xl border border-zs p-5"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-fg">Strategy · Combos</div>
          <div className="mt-0.5 text-[11px] text-fg-muted">
            Correlation-adjusted anchor plays generated from qualifying individual picks.
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <span className="text-[11px] text-fg-muted">{policy.enabled ? "On" : "Off"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={policy.enabled}
            onClick={() => update({ enabled: !policy.enabled })}
            className="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus-visible:outline-none"
            style={{
              background: policy.enabled ? "var(--zs-info)" : "var(--zs-border-bright)",
            }}
          >
            <span
              className="pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform"
              style={{ transform: policy.enabled ? "translateX(16px)" : "translateX(0)" }}
            />
          </button>
        </label>
      </div>

      {policy.enabled && (
        <div className="grid grid-cols-3 gap-3">
          <ThresholdField
            label="Min odds"
            value={policy.minCombinedDecimal}
            step={0.05}
            min={1.1}
            max={5}
            onChange={(v) => update({ minCombinedDecimal: v })}
          />
          <ThresholdField
            label="Min edge %"
            value={+(policy.minCombinedEdge * 100).toFixed(1)}
            step={0.5}
            min={1}
            max={20}
            display={(v) => `${v}%`}
            onChange={(v) => update({ minCombinedEdge: v / 100 })}
          />
          <ThresholdField
            label="Min fair prob %"
            value={+(policy.minCombinedFairProb * 100).toFixed(0)}
            step={1}
            min={20}
            max={80}
            display={(v) => `${v}%`}
            onChange={(v) => update({ minCombinedFairProb: v / 100 })}
          />
        </div>
      )}
    </div>
  );
}

function ThresholdField({
  label,
  value,
  step,
  min,
  max,
  display,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  display?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-wider text-fg-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-zs hover:text-fg"
          onClick={() => onChange(Math.max(min, +(value - step).toFixed(4)))}
        >
          −
        </button>
        <span className="min-w-[3rem] text-center font-mono text-[12px] text-fg">
          {display ? display(value) : value.toFixed(2)}
        </span>
        <button
          type="button"
          className="flex size-6 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-zs hover:text-fg"
          onClick={() => onChange(Math.min(max, +(value + step).toFixed(4)))}
        >
          +
        </button>
      </div>
    </div>
  );
}
