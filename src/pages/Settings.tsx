import { Skeleton } from "@/components/ui/skeleton";
import { ScreenHeader } from "@/components/zs";
import { DangerZoneCard } from "@/features/settings/components/DangerZoneCard";
import { DataCard } from "@/features/settings/components/DataCard";
import { LeaguesPicker } from "@/features/settings/components/LeaguesPicker";
import { OddsApiKeyCard } from "@/features/settings/components/OddsApiKeyCard";
import { ProviderConfigCard, ProvidersCard } from "@/features/settings/components/ProvidersCard";
import { useSettings } from "@/features/settings/hooks/useSettings";

export function Settings() {
  const { data, loading, update } = useSettings();

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket="SETTINGS · CONFIG"
        title="SETTINGS"
        sub="KEYS · PROVIDERS · LEAGUES · DATA"
      />

      {loading || !data ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 18 }}>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1080 }}>
          <OddsApiKeyCard settings={data} onUpdate={update} />
          <ProvidersCard settings={data} onUpdate={update} />
          <ProviderConfigCard settings={data} onUpdate={update} />
          <LeaguesPicker settings={data} onUpdate={update} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <DataCard />
            <DangerZoneCard />
          </div>
        </div>
      )}
    </div>
  );
}
