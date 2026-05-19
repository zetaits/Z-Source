import { Block } from "@/components/zs";
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
    if (disabled) return;
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange([...next]);
  };

  const onCount = descriptors.filter((m) => set.has(m.key)).length;

  return (
    <Block head={`MARKETS · ${onCount}/${descriptors.length} ENABLED`}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
        {descriptors.map((m) => {
          const active = set.has(m.key);
          return (
            <label
              key={m.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                border: "1px solid var(--zs-border)",
                background: "var(--zs-bg)",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
              }}
              onClick={(e) => {
                e.preventDefault();
                toggle(m.key);
              }}
            >
              <span
                role="checkbox"
                aria-checked={active}
                className={`zs-check ${active ? "on" : ""}`}
              />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: active ? "var(--zs-fg)" : "var(--zs-fg-muted)",
                  flex: 1,
                }}
              >
                {m.label}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--zs-fg-muted)" }}>
                {active ? "ON" : "OFF"}
              </span>
            </label>
          );
        })}
      </div>
    </Block>
  );
}
