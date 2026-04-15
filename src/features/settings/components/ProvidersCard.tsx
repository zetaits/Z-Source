import { Globe2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppSettings } from "@/services/settings/settingsStore";

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

export function ProvidersCard({ settings, onUpdate }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Globe2 className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Providers</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Catalog: scraping (SofaScore default). Odds: OddsAPI. Splits & history: deterministic mock until a real feed lands.
          </p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            Splits provider
          </Label>
          <Select disabled value="mock">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">Mock (deterministic)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Seeded per matchId. Real feeds (SBD / Action / VSiN) land post-v1.
          </p>
        </div>

        <div className="grid gap-2">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            History provider
          </Label>
          <Select disabled value="mock">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mock">Mock (deterministic)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Form, H2H, intangibles. Swap for a real provider when ready.
          </p>
        </div>
      </div>
    </section>
  );
}
