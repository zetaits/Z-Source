import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader, Tag } from "@/components/zs";
import { LegWeightsCard } from "@/features/strategy/components/LegWeightsCard";
import { MarketsCard } from "@/features/strategy/components/MarketsCard";
import { RulesCard } from "@/features/strategy/components/RulesCard";
import { StakePolicyCard } from "@/features/strategy/components/StakePolicyCard";
import { useStrategy } from "@/features/strategy/hooks/useStrategy";

export function Strategy() {
  const {
    strategy,
    loading,
    persistent,
    setStakePolicy,
    setLegWeights,
    setEnabledMarkets,
    setRuleConfig,
  } = useStrategy();

  const disabled = !persistent;
  const ruleCount = strategy?.rules.length ?? 0;
  const ruleOn = (strategy?.rules ?? []).filter((r) => r.enabled).length;

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket={`STRATEGY · BONDED ENGINE · ${ruleOn}/${ruleCount} RULES`}
        title="CALIBRATE"
        sub="Changes save on the spot · open analyses re-trigger automatically"
        right={persistent ? <Tag tone="pos">PERSISTENT ✓</Tag> : <Tag tone="amber">PREVIEW</Tag>}
      />

      {!persistent && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 14px",
            border: "1px solid var(--zs-accent)",
            background: "var(--zs-accent-fill)",
            color: "var(--zs-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            marginBottom: 16,
          }}
        >
          <AlertTriangle className="mt-0.5 size-4 flex-none" style={{ color: "var(--zs-accent)" }} aria-hidden />
          <div>
            Persistent storage unavailable (web preview). Edits won&apos;t stick — run the desktop app to calibrate.
          </div>
        </div>
      )}

      {loading || !strategy ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <StakePolicyCard policy={strategy.stakePolicy} disabled={disabled} onChange={setStakePolicy} />
          <LegWeightsCard weights={strategy.legWeights} disabled={disabled} onChange={setLegWeights} />
          <MarketsCard enabled={strategy.enabledMarkets} disabled={disabled} onChange={setEnabledMarkets} />
          <RulesCard rules={strategy.rules} disabled={disabled} onChange={setRuleConfig} />
        </div>
      )}
    </div>
  );
}
