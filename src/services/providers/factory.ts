import { createActionNetworkSplitProvider } from "@/services/impl/actionNetworkSplitProvider";
import { createOddsApiIoProvider } from "@/services/impl/oddsApiIoProvider";
import { createSofaScoreHistoryProvider } from "@/services/impl/sofaScoreHistoryProvider";
import {
  oddsApiIoQuota,
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

const FIXED_ODDS_ORDER: OddsProviderId[] = ["odds-api-io"];

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
  const provider = createOddsApiIoProvider(() => ({
    apiKey: settings.oddsApiIoKey ?? "",
    sportSlug: "football",
    bookmakers: settings.userBooks.length > 0 ? settings.userBooks : undefined,
  }));
  return { id, provider, configured: Boolean(settings.oddsApiIoKey) };
};

const trackerForId = (_id: OddsProviderId): QuotaTracker => oddsApiIoQuota;

const buildSplitProvider = (_id: SplitProviderId): SplitProvider =>
  createActionNetworkSplitProvider();

const buildHistoryProvider = (_id: HistoryProviderId, settings: AppSettings): HistoryProvider =>
  createSofaScoreHistoryProvider(settings.footballDataApiKey ?? undefined);

export const resolveProviders = (settings: AppSettings): ResolvedProviders => {
  const order = FIXED_ODDS_ORDER;

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
    history: buildHistoryProvider(settings.historyProviderId, settings),
    quotaTrackers,
  };
};
