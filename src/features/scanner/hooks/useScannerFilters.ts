import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { CatalogMatch, MatchStatus } from "@/domain/match";

export type StatusFilter = "all" | "scheduled" | "live" | "ft";
export type SortKey = "kickoff" | "league" | "status";

export interface ScannerFilters {
  status: StatusFilter;
  leagues: string[];
  sort: SortKey;
}

const DEFAULTS: ScannerFilters = {
  status: "all",
  leagues: [],
  sort: "kickoff",
};

const STATUS_MAP: Record<StatusFilter, MatchStatus[] | null> = {
  all: null,
  scheduled: ["SCHEDULED"],
  live: ["LIVE"],
  ft: ["FT"],
};

const parseStatus = (raw: string | null): StatusFilter => {
  if (raw === "scheduled" || raw === "live" || raw === "ft") return raw;
  return "all";
};

const parseSort = (raw: string | null): SortKey => {
  if (raw === "league" || raw === "status") return raw;
  return "kickoff";
};

const parseLeagues = (raw: string | null): string[] => {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

export function useScannerFilters() {
  const [params, setParams] = useSearchParams();

  const filters: ScannerFilters = useMemo(
    () => ({
      status: parseStatus(params.get("status")),
      leagues: parseLeagues(params.get("leagues")),
      sort: parseSort(params.get("sort")),
    }),
    [params],
  );

  const update = useCallback(
    (next: Partial<ScannerFilters>) => {
      const merged: ScannerFilters = { ...filters, ...next };
      const sp = new URLSearchParams(params);
      if (merged.status === DEFAULTS.status) sp.delete("status");
      else sp.set("status", merged.status);
      if (merged.leagues.length === 0) sp.delete("leagues");
      else sp.set("leagues", merged.leagues.join(","));
      if (merged.sort === DEFAULTS.sort) sp.delete("sort");
      else sp.set("sort", merged.sort);
      setParams(sp, { replace: true });
    },
    [filters, params, setParams],
  );

  const apply = useCallback(
    (matches: CatalogMatch[]): CatalogMatch[] => {
      let out = matches;
      const statuses = STATUS_MAP[filters.status];
      if (statuses) out = out.filter((m) => statuses.includes(m.status));
      if (filters.leagues.length > 0) {
        const set = new Set(filters.leagues);
        out = out.filter((m) => set.has(String(m.leagueId)));
      }
      switch (filters.sort) {
        case "league":
          out = [...out].sort(
            (a, b) =>
              (a.leagueName ?? String(a.leagueId)).localeCompare(b.leagueName ?? String(b.leagueId))
              || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
          );
          break;
        case "status":
          out = [...out].sort(
            (a, b) =>
              a.status.localeCompare(b.status)
              || new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
          );
          break;
        default:
          out = [...out].sort(
            (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
          );
      }
      return out;
    },
    [filters],
  );

  return { filters, update, apply };
}
