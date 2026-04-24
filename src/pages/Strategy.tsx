import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Strategy</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Calibrate the Bonded engine. Changes are saved on the spot and re-trigger any open
          match analysis automatically.
        </p>
      </header>

      {!persistent ? (
        <div
          className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground"
          role="status"
        >
          <AlertTriangle className="mt-0.5 size-4 flex-none text-warning" aria-hidden />
          <div className="text-foreground">
            Persistent storage unavailable (web preview). Edits won&apos;t stick — run the desktop
            app to calibrate.
          </div>
        </div>
      ) : null}

      {loading || !strategy ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="flex max-w-4xl flex-col gap-5">
          <StakePolicyCard
            policy={strategy.stakePolicy}
            disabled={disabled}
            onChange={setStakePolicy}
          />
          <LegWeightsCard
            weights={strategy.legWeights}
            disabled={disabled}
            onChange={setLegWeights}
          />
          <MarketsCard
            enabled={strategy.enabledMarkets}
            disabled={disabled}
            onChange={setEnabledMarkets}
          />
          <RulesCard rules={strategy.rules} disabled={disabled} onChange={setRuleConfig} />
        </div>
      )}
    </div>
  );
}
