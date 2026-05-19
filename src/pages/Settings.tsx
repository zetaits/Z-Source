import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader } from "@/components/zs";
import { CacheResetCard } from "@/features/settings/components/CacheResetCard";
import { DataCard } from "@/features/settings/components/DataCard";
import { DemoSeedCard } from "@/features/settings/components/DemoSeedCard";
import { LeaguesPicker } from "@/features/settings/components/LeaguesPicker";
import { OddsApiKeyCard } from "@/features/settings/components/OddsApiKeyCard";
import { ProvidersCard } from "@/features/settings/components/ProvidersCard";
import { StrategyCard } from "@/features/settings/components/StrategyCard";
import { useSettings } from "@/features/settings/hooks/useSettings";

export function Settings() {
  const { data, loading, update } = useSettings();

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket="SETTINGS · PROVIDERS · LEAGUES · DATA"
        title="CONFIG"
        sub="OddsAPI consumption only kicks in when you open a match"
      />

      {loading || !data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1080 }}>
          <OddsApiKeyCard settings={data} onUpdate={update} />
          <ProvidersCard settings={data} onUpdate={update} />
          <LeaguesPicker settings={data} onUpdate={update} />
          <StrategyCard />
          <DataCard />
          {import.meta.env.DEV && <DemoSeedCard />}
          <CacheResetCard />
        </div>
      )}
    </div>
  );
}
