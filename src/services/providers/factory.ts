import { createActionNetworkSplitProvider } from "@/services/impl/actionNetworkSplitProvider";
import { createOddsApiIoProvider } from "@/services/impl/oddsApiIoProvider";
import { createOddsApiProvider } from "@/services/impl/oddsApiProvider";
import { createSofaScoreHistoryProvider } from "@/services/impl/sofaScoreHistoryProvider";
import {
  oddsApiIoQuota,
  oddsApiQuota,
  type QuotaTracker,
} from "@/services/http/quotaTracker";
import type {
  AppSettings,
  HistoryProviderId,
  OddsProviderId,
  SplitProviderId,
} from "@/services/settings/settingsStore";
import type { HistoryProvider } from "./HistoryProvider";
import type { OddsProvider } from "./OddsProvider";
import type { SplitProvider } from "./SplitProvider";
import { createFallbackOddsProvider } from "./FallbackOddsProvider";

export interface ResolvedProviders {
  odds: OddsProvider;
  oddsComponents: { id: OddsProviderId; provider: OddsProvider; configured: boolean }[];
  splits: SplitProvider;
  history: HistoryProvider;
  quotaTrackers: QuotaTracker[];
}

const buildOddsComponent = (
  id: OddsProviderId,
  settings: AppSettings,
): { id: OddsProviderId; provider: OddsProvider; configured: boolean } => {
  if (id === "the-odds-api") {
    const provider = createOddsApiProvider(() => ({
      apiKey: settings.oddsApiKey ?? "",
      region: settings.oddsRegion,
      oddsFormat: "decimal",
    }));
    return { id, provider, configured: Boolean(settings.oddsApiKey) };
  }
  const provider = createOddsApiIoProvider(() => ({
    apiKey: settings.oddsApiIoKey ?? "",
    sportSlug: "football",
  }));
  return { id, provider, configured: Boolean(settings.oddsApiIoKey) };
};

const trackerForId = (id: OddsProviderId): QuotaTracker =>
  id === "the-odds-api" ? oddsApiQuota : oddsApiIoQuota;

const buildSplitProvider = (_id: SplitProviderId): SplitProvider =>
  createActionNetworkSplitProvider();

const buildHistoryProvider = (_id: HistoryProviderId): HistoryProvider =>
  createSofaScoreHistoryProvider();

export const resolveProviders = (settings: AppSettings): ResolvedProviders => {
  const order = settings.oddsProviderOrder.length > 0
    ? settings.oddsProviderOrder
    : (["odds-api-io", "the-odds-api"] as OddsProviderId[]);

  const oddsComponents = order.map((id) => buildOddsComponent(id, settings));
  const configured = oddsComponents.filter((c) => c.configured);
  const activeComponents = configured.length > 0 ? configured : oddsComponents;
  const odds = activeComponents.length === 1
    ? activeComponents[0].provider
    : createFallbackOddsProvider(activeComponents.map((c) => c.provider));

  const quotaTrackers = order.map(trackerForId);

  return {
    odds,
    oddsComponents,
    splits: buildSplitProvider(settings.splitProviderId),
    history: buildHistoryProvider(settings.historyProviderId),
    quotaTrackers,
  };
};
