import { Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { LEAGUES } from "@/config/leagues";
import type { AppSettings } from "@/services/settings/settingsStore";

interface Props {
  settings: AppSettings;
  onUpdate(patch: Partial<AppSettings>): Promise<void>;
}

export function LeaguesPicker({ settings, onUpdate }: Props) {
  const enabled = new Set(settings.enabledLeagueIds);

  const toggle = async (leagueId: string, on: boolean) => {
    const next = new Set(enabled);
    if (on) next.add(leagueId);
    else next.delete(leagueId);
    await onUpdate({ enabledLeagueIds: [...next] });
  };

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Layers className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Leagues</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Catalog comes from the scraper · enabling more leagues does not consume OddsAPI quota.
          </p>
        </div>
      </header>

      <ul className="grid gap-2 sm:grid-cols-2">
        {LEAGUES.map((league) => {
          const checked = enabled.has(String(league.id));
          return (
            <li
              key={league.id}
              className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2"
            >
              <label className="flex flex-1 items-center gap-3">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => void toggle(String(league.id), Boolean(v))}
                  aria-label={league.name}
                />
                <span className="flex flex-col">
                  <span className="text-sm">{league.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {league.countryCode} · tier {league.tier}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
