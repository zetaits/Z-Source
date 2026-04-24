import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { LeagueAccordion } from "@/components/domain/LeagueAccordion";
import { DateTabs } from "@/features/scanner/components/DateTabs";
import { useScanner } from "@/features/scanner/hooks/useScanner";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  countryCode: string;
  matches: CatalogMatch[];
}

const groupByLeague = (matches: CatalogMatch[]): LeagueGroup[] => {
  const map = new Map<string, LeagueGroup>();
  for (const m of matches) {
    const id = String(m.leagueId);
    let g = map.get(id);
    if (!g) {
      const def = findLeagueById(id);
      g = {
        leagueId: id,
        leagueName: def?.name ?? m.leagueName ?? id,
        countryCode: def?.countryCode ?? m.countryCode ?? "—",
        matches: [],
      };
      map.set(id, g);
    }
    g.matches.push(m);
  }
  return [...map.values()].sort((a, b) => a.leagueName.localeCompare(b.leagueName));
};

export function Scanner() {
  const [offset, setOffset] = useState(0);
  const window = useMemo(() => ({ date: new Date(), dayOffset: offset }), [offset]);
  const { data: settings } = useSettings();
  const fixtures = useScanner(window);

  const groups = useMemo(() => groupByLeague(fixtures.data ?? []), [fixtures.data]);
  const enabledCount = settings?.enabledLeagueIds.length ?? 0;

  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    const message = fixtures.isError
      ? (fixtures.error as Error | undefined)?.message ?? "Catalog fetch failed"
      : null;
    if (message && message !== lastErrorRef.current) {
      lastErrorRef.current = message;
      toast.error("Catalog unavailable", { description: message });
    }
    if (!message) lastErrorRef.current = null;
  }, [fixtures.isError, fixtures.error]);

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Scanner</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Fixtures via scraping · OddsAPI quota untouched. Click a match to run analysis on demand.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DateTabs value={offset} onChange={setOffset} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fixtures.refetch()}
              disabled={fixtures.isFetching}
            >
              <RefreshCcw className={`mr-2 size-3.5 ${fixtures.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {enabledCount === 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>No leagues enabled</AlertTitle>
          <AlertDescription>
            Pick the leagues you want to scan in <Link className="text-primary hover:underline" to="/settings">Settings</Link>.
          </AlertDescription>
        </Alert>
      )}

      {fixtures.isError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Catalog unavailable</AlertTitle>
          <AlertDescription>
            {(fixtures.error as Error)?.message ?? "Unknown error"}
          </AlertDescription>
        </Alert>
      )}

      {fixtures.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <LeagueAccordion groups={groups} />
      )}
    </div>
  );
}
