import {
  DEFAULT_LEG_WEIGHTS,
  DEFAULT_STAKE_POLICY,
  type LegWeights,
  type StakePolicy,
  type StrategyConfig,
} from "@/domain/strategy";
import type { MarketKey } from "@/domain/market";
import { isPersistentStorage } from "@/storage";
import { settingsRepo } from "@/storage/repos/settingsRepo";
import { strategyRepo } from "@/storage/repos/strategyRepo";

export const DEFAULT_ENABLED_MARKETS: MarketKey[] = [
  "ML_1X2",
  "DNB",
  "AH",
  "OU_GOALS",
  "BTTS",
  "CORNERS_TOTAL",
];

const K_STAKE_POLICY = "strategy.stakePolicy";
const K_LEG_WEIGHTS = "strategy.legWeights";
const K_ENABLED_MARKETS = "strategy.enabledMarkets";

export const loadStrategy = async (): Promise<StrategyConfig> => {
  if (!isPersistentStorage()) {
    return {
      legWeights: DEFAULT_LEG_WEIGHTS,
      stakePolicy: DEFAULT_STAKE_POLICY,
      rules: [],
      enabledMarkets: DEFAULT_ENABLED_MARKETS,
    };
  }
  const [rules, stakePolicy, legWeights, enabledMarkets] = await Promise.all([
    strategyRepo.listAll(),
    settingsRepo.get<StakePolicy>(K_STAKE_POLICY),
    settingsRepo.get<LegWeights>(K_LEG_WEIGHTS),
    settingsRepo.get<MarketKey[]>(K_ENABLED_MARKETS),
  ]);
  return {
    legWeights: legWeights ?? DEFAULT_LEG_WEIGHTS,
    stakePolicy: stakePolicy ?? DEFAULT_STAKE_POLICY,
    rules: rules.map((r) => ({
      ruleId: r.ruleId,
      enabled: r.enabled,
      weight: r.weight,
      params: r.params,
    })),
    enabledMarkets: enabledMarkets ?? DEFAULT_ENABLED_MARKETS,
  };
};

export const saveStakePolicy = (policy: StakePolicy): Promise<void> =>
  settingsRepo.set(K_STAKE_POLICY, policy);

export const saveLegWeights = (weights: LegWeights): Promise<void> =>
  settingsRepo.set(K_LEG_WEIGHTS, weights);

export const saveEnabledMarkets = (markets: MarketKey[]): Promise<void> =>
  settingsRepo.set(K_ENABLED_MARKETS, markets);

export const strategyFingerprint = (s: StrategyConfig): string => {
  const rulePart = s.rules
    .map((r) => `${r.ruleId}:${r.enabled ? 1 : 0}:${r.weight.toFixed(2)}`)
    .sort()
    .join("|");
  const stakePart = `${s.stakePolicy.kind}:${s.stakePolicy.kellyFraction}:${s.stakePolicy.minEdgePct}:${s.stakePolicy.minConfidence}`;
  const marketsPart = s.enabledMarkets.slice().sort().join(",");
  return `${rulePart}#${stakePart}#${marketsPart}`;
};
