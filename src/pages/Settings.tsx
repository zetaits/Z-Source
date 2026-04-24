import { Skeleton } from "@/components/ui/skeleton";
import { CacheResetCard } from "@/features/settings/components/CacheResetCard";
import { DataCard } from "@/features/settings/components/DataCard";
import { LeaguesPicker } from "@/features/settings/components/LeaguesPicker";
import { OddsApiKeyCard } from "@/features/settings/components/OddsApiKeyCard";
import { ProvidersCard } from "@/features/settings/components/ProvidersCard";
import { useSettings } from "@/features/settings/hooks/useSettings";

export function Settings() {
  const { data, loading, update } = useSettings();

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Configure providers and the leagues you want to scan. OddsAPI consumption only kicks in when you open a match.
        </p>
      </header>

      {loading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="flex max-w-4xl flex-col gap-5">
          <OddsApiKeyCard settings={data} onUpdate={update} />
          <ProvidersCard settings={data} onUpdate={update} />
          <LeaguesPicker settings={data} onUpdate={update} />
          <DataCard />
          <CacheResetCard />
        </div>
      )}
    </div>
  );
}
