import { Layers } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MARKETS } from "@/config/markets";
import type { MarketKey } from "@/domain/market";
import { MARKET_ADAPTERS } from "@/engine/markets";

interface Props {
  enabled: MarketKey[];
  disabled?: boolean;
  onChange(markets: MarketKey[]): void;
}

export function MarketsCard({ enabled, disabled, onChange }: Props) {
  const available = new Set(MARKET_ADAPTERS.map((a) => a.key));
  const descriptors = MARKETS.filter((m) => available.has(m.key));
  const set = new Set(enabled);

  const toggle = (key: MarketKey) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  };

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Layers className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Markets</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Markets the engine will scan for plays. Disabled markets are skipped entirely.
          </p>
        </div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2">
        {descriptors.map((m) => {
          const active = set.has(m.key);
          const id = `market-${m.key}`;
          return (
            <label
              key={m.key}
              htmlFor={id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background/40 p-3 text-sm transition-colors hover:border-primary/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <Checkbox
                id={id}
                checked={active}
                disabled={disabled}
                onCheckedChange={() => toggle(m.key)}
              />
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{m.label}</span>
                <Label
                  htmlFor={id}
                  className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  {m.key} · {m.group}
                </Label>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
