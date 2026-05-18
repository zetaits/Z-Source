import { useMemo } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
import { useScannerFilters, type SortKey, type StatusFilter } from "../hooks/useScannerFilters";

interface Props {
  /** matches in the currently selected day, before filters — used to enumerate league options */
  dayMatches: CatalogMatch[];
}

const STATUS_OPTS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "ft", label: "FT" },
];

const SORT_OPTS: { value: SortKey; label: string }[] = [
  { value: "kickoff", label: "Kickoff ↑" },
  { value: "league", label: "League A→Z" },
  { value: "status", label: "Status" },
];

export function FilterBar({ dayMatches }: Props) {
  const { filters, update } = useScannerFilters();

  const leagueOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; country: string }>();
    for (const m of dayMatches) {
      const id = String(m.leagueId);
      if (map.has(id)) continue;
      const def = findLeagueById(id);
      map.set(id, {
        id,
        name: def?.name ?? m.leagueName ?? id,
        country: def?.countryCode ?? m.countryCode ?? "—",
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [dayMatches]);

  const leaguesActive = filters.leagues.length;
  const leaguesLabel = leaguesActive === 0 ? `Leagues (${leagueOptions.length})` : `Leagues · ${leaguesActive} of ${leagueOptions.length}`;

  const toggleLeague = (id: string, checked: boolean) => {
    const next = checked
      ? [...filters.leagues, id]
      : filters.leagues.filter((l) => l !== id);
    update({ leagues: next });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zs px-3 py-2" style={{ background: "var(--zs-bg-elev)" }}>
      {/* Status segmented */}
      <div className="flex items-center gap-1">
        <span className="kicker mr-1">Status</span>
        <div className="flex items-center gap-1">
          {STATUS_OPTS.map((o) => {
            const active = filters.status === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ status: o.value })}
                className={cn("pill", active ? "pill-info" : "pill-ghost", "uppercase")}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      <span className="h-5 w-px bg-zs-border" />

      {/* Leagues popover */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "pill",
              leaguesActive > 0 ? "pill-info" : "pill-ghost",
              "uppercase",
            )}
            disabled={leagueOptions.length === 0}
          >
            <Filter className="size-3" aria-hidden />
            {leaguesLabel}
            <ChevronDown className="size-3" aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2" style={{ background: "var(--zs-bg-elev)", borderColor: "var(--zs-border)" }}>
          <div className="kicker mb-2 px-1">Filter leagues</div>
          {leagueOptions.length === 0 ? (
            <p className="px-1 py-2 text-xs text-fg-muted">No leagues on this day.</p>
          ) : (
            <ul className="flex max-h-72 flex-col gap-1 overflow-auto zs-scroll pr-1">
              {leagueOptions.map((opt) => {
                const checked = filters.leagues.includes(opt.id);
                return (
                  <li key={opt.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zs-surface">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleLeague(opt.id, v === true)}
                      />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">{opt.country}</span>
                      <span className="truncate text-[13px] text-fg">{opt.name}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {leaguesActive > 0 && (
            <button
              type="button"
              onClick={() => update({ leagues: [] })}
              className="mt-2 w-full rounded-md px-2 py-1.5 text-left font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:bg-zs-surface hover:text-fg"
            >
              clear selection
            </button>
          )}
        </PopoverContent>
      </Popover>

      <span className="h-5 w-px bg-zs-border" />

      {/* Sort */}
      <div className="flex items-center gap-1">
        <span className="kicker mr-1">Sort</span>
        <select
          value={filters.sort}
          onChange={(e) => update({ sort: e.target.value as SortKey })}
          className="rounded-sm border border-zs bg-transparent px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-fg focus:outline-none focus:ring-2 focus:ring-ring"
          style={{ background: "var(--zs-bg-elev)" }}
        >
          {SORT_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
