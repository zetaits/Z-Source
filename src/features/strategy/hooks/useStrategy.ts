import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LegWeights,
  RuleConfig,
  StakePolicy,
  StrategyConfig,
} from "@/domain/strategy";
import type { MarketKey } from "@/domain/market";
import {
  loadStrategy,
  saveEnabledMarkets,
  saveLegWeights,
  saveStakePolicy,
} from "@/features/match-detail/hooks/loadStrategy";
import { isPersistentStorage } from "@/storage";
import { strategyRepo } from "@/storage/repos/strategyRepo";

const STRATEGY_KEY = ["strategy"] as const;

export const useStrategy = () => {
  const qc = useQueryClient();

  const query = useQuery<StrategyConfig>({
    queryKey: STRATEGY_KEY,
    queryFn: () => loadStrategy(),
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: STRATEGY_KEY });
    qc.invalidateQueries({ queryKey: ["analysis"] });
  };

  const stakePolicyMutation = useMutation({
    mutationFn: async (policy: StakePolicy) => {
      await saveStakePolicy(policy);
    },
    onSuccess: invalidate,
  });

  const legWeightsMutation = useMutation({
    mutationFn: async (weights: LegWeights) => {
      await saveLegWeights(weights);
    },
    onSuccess: invalidate,
  });

  const marketsMutation = useMutation({
    mutationFn: async (markets: MarketKey[]) => {
      await saveEnabledMarkets(markets);
    },
    onSuccess: invalidate,
  });

  const ruleMutation = useMutation({
    mutationFn: async (row: RuleConfig) => {
      await strategyRepo.upsert({
        ruleId: row.ruleId,
        enabled: row.enabled,
        weight: row.weight,
        params: row.params,
      });
    },
    onSuccess: invalidate,
  });

  return {
    strategy: query.data,
    loading: query.isLoading,
    persistent: isPersistentStorage(),
    setStakePolicy: stakePolicyMutation.mutate,
    setLegWeights: legWeightsMutation.mutate,
    setEnabledMarkets: marketsMutation.mutate,
    setRuleConfig: ruleMutation.mutate,
  };
};
