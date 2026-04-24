import { Globe2, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HISTORY_PROVIDER_IDS,
  ODDS_PROVIDER_IDS,
  SPLIT_PROVIDER_IDS,
  type AppSettings,
  type HistoryProviderId,
  type OddsProviderId,
  type SplitProviderId,
} from "@/services/settings/settingsStore";

interface Props {
  settings: AppSettings;
  onUpdate(patch: Partial<AppSettings>): Promise<void>;
}

const REGIONS: { value: AppSettings["oddsRegion"]; label: string }[] = [
  { value: "eu", label: "Europe (eu)" },
  { value: "uk", label: "United Kingdom (uk)" },
  { value: "us", label: "United States (us)" },
  { value: "au", label: "Australia (au)" },
];

const ODDS_PROVIDER_LABEL: Record<OddsProviderId, string> = {
  "odds-api-io": "odds-api.io (100/h · free)",
  "the-odds-api": "the-odds-api.com (500/mo · free)",
};

const SPLIT_PROVIDER_LABEL: Record<SplitProviderId, string> = {
  "action-network": "Action Network (public API)",
};

const HISTORY_PROVIDER_LABEL: Record<HistoryProviderId, string> = {
  sofascore: "SofaScore (scraping)",
};

const ODDS_PRIMARY_HELP =
  "Tried first on every analysis. If it errors or returns no event for the fixture, the fallback is tried next.";
const ODDS_FALLBACK_HELP =
  "Used only if the primary fails. Quotas: odds-api.io = 100 req/hour, the-odds-api.com = 500 req/month (both free-tier).";
const SPLITS_HELP =
  "Action Network's public JSON API (money-line tickets/money %). Cached 10 min per match.";
const HISTORY_HELP =
  "`sofascore` scrapes public endpoints for team form, H2H, and rest days. " +
  "Caches: form 6h, H2H 7d, intangibles 1h.";

const applyOrder = (
  current: OddsProviderId[],
  slot: "primary" | "fallback",
  next: OddsProviderId,
): OddsProviderId[] => {
  const primary = slot === "primary" ? next : current[0] ?? "odds-api-io";
  const fallbackPool = ODDS_PROVIDER_IDS.filter((id) => id !== primary);
  let fallback: OddsProviderId;
  if (slot === "fallback") {
    fallback = next === primary ? fallbackPool[0] : next;
  } else {
    fallback = fallbackPool.find((id) => current[1] === id) ?? fallbackPool[0];
  }
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
};

function FieldLabel({ text, help }: { text: string; help: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
        {text}
      </Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground/60 transition-colors hover:text-foreground"
            aria-label={`${text} info`}
          >
            <Info className="size-3" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-snug">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ProvidersCard({ settings, onUpdate }: Props) {
  const [primary, fallback] = settings.oddsProviderOrder;
  const fallbackOptions = ODDS_PROVIDER_IDS.filter((id) => id !== primary);

  const updateOrder = (slot: "primary" | "fallback", value: OddsProviderId) =>
    void onUpdate({ oddsProviderOrder: applyOrder(settings.oddsProviderOrder, slot, value) });

  return (
    <TooltipProvider delayDuration={200}>
      <section className="rounded-lg border border-border bg-card/40 p-5">
        <header className="mb-4 flex items-start gap-3">
          <Globe2 className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold">Providers</h2>
            <p className="mt-1 max-w-prose text-xs text-muted-foreground">
              Catalog scrapes SofaScore. Odds, splits and history each have their own provider —
              hover the info icons for cost, coverage and cache behaviour.
            </p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <FieldLabel text="Odds primary" help={ODDS_PRIMARY_HELP} />
            <Select
              value={primary}
              onValueChange={(v) => updateOrder("primary", v as OddsProviderId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ODDS_PROVIDER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {ODDS_PROVIDER_LABEL[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <FieldLabel text="Odds fallback" help={ODDS_FALLBACK_HELP} />
            <Select
              value={fallback ?? fallbackOptions[0]}
              onValueChange={(v) => updateOrder("fallback", v as OddsProviderId)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fallbackOptions.map((id) => (
                  <SelectItem key={id} value={id}>
                    {ODDS_PROVIDER_LABEL[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Catalog provider
            </Label>
            <Select disabled value={settings.catalogProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sofascore">SofaScore (scraping)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              OddsAPI region
            </Label>
            <Select
              value={settings.oddsRegion}
              onValueChange={(v) => void onUpdate({ oddsRegion: v as AppSettings["oddsRegion"] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <FieldLabel text="Splits provider" help={SPLITS_HELP} />
            <Select
              value={settings.splitProviderId}
              onValueChange={(v) => void onUpdate({ splitProviderId: v as SplitProviderId })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPLIT_PROVIDER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {SPLIT_PROVIDER_LABEL[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <FieldLabel text="History provider" help={HISTORY_HELP} />
            <Select
              value={settings.historyProviderId}
              onValueChange={(v) => void onUpdate({ historyProviderId: v as HistoryProviderId })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HISTORY_PROVIDER_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {HISTORY_PROVIDER_LABEL[id]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
}
