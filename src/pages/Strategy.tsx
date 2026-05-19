import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader, Tag } from "@/components/zs";
import { ComboPolicyCard } from "@/features/strategy/components/ComboPolicyCard";
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
    setMinLegsAlignedForBonded,
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
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            border: "1px solid var(--zs-accent)",
            background: "var(--zs-accent-fill)",
            color: "var(--zs-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            marginBottom: 16,
          }}
        >
          <Tag tone="amber">⚠ PREVIEW</Tag>
          <span>Persistent storage unavailable (web preview). Edits won&apos;t stick — run the desktop app to calibrate.</span>
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
          <LegWeightsCard
            weights={strategy.legWeights}
            disabled={disabled}
            onChange={setLegWeights}
            minLegsAlignedForBonded={strategy.minLegsAlignedForBonded}
            onMinLegsChange={setMinLegsAlignedForBonded}
          />
          <div data-tour-id="strategy-rules">
            <RulesCard rules={strategy.rules} disabled={disabled} onChange={setRuleConfig} />
          </div>
          <MarketsCard enabled={strategy.enabledMarkets} disabled={disabled} onChange={setEnabledMarkets} />
          <ComboPolicyCard />
        </div>
      )}
    </div>
  );
}
