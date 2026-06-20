import { useEffect, useState } from "react";
import { Block, Tag } from "@/components/zs";
import {
  HISTORY_PROVIDER_IDS,
  SPLIT_PROVIDER_IDS,
  type AppSettings,
  type HistoryProviderId,
  type SplitProviderId,
} from "@/services/settings/settingsStore";

interface Props {
  settings: AppSettings;
  onUpdate(patch: Partial<AppSettings>): Promise<void>;
}

const REGIONS: { value: AppSettings["oddsRegion"]; label: string }[] = [
  { value: "eu", label: "EUROPE (EU)" },
  { value: "uk", label: "UNITED KINGDOM (UK)" },
  { value: "us", label: "UNITED STATES (US)" },
  { value: "au", label: "AUSTRALIA (AU)" },
];

const SPLIT_PROVIDER_LABEL: Record<SplitProviderId, string> = {
  "action-network": "Action Network (public API)",
};

const HISTORY_PROVIDER_LABEL: Record<HistoryProviderId, string> = {
  none: "None (no history source)",
};

const captionStyle = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--zs-fg-muted)" } as const;
const rowStyle = { display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--zs-rule)" } as const;

export function ProvidersCard({ settings }: Props) {
  const hasFdorg = Boolean(settings.footballDataApiKey);

  const chain: { name: string; kind: string; status: "ok" | "warn" | "off"; statusLabel: string }[] = [
    {
      name: hasFdorg ? "odds-api.io + football-data.org" : "odds-api.io",
      kind: "CATALOG",
      status: settings.oddsApiIoKey ? "ok" : "off",
      statusLabel: settings.oddsApiIoKey ? "OK" : "NO KEY",
    },
    {
      name: "odds-api.io",
      kind: "ODDS",
      status: settings.oddsApiIoKey ? "ok" : "off",
      statusLabel: settings.oddsApiIoKey ? "OK" : "NO KEY",
    },
    {
      name: SPLIT_PROVIDER_LABEL[settings.splitProviderId],
      kind: "SPLITS",
      status: "ok",
      statusLabel: "OK",
    },
    {
      name: HISTORY_PROVIDER_LABEL[settings.historyProviderId],
      kind: "HISTORY",
      status: "ok",
      statusLabel: "OK",
    },
  ];

  return (
    <Block head="PROVIDERS · FALLBACK CHAIN" pad={false}>
      <table className="zs-table">
        <thead>
          <tr>
            <th>PROVIDER</th>
            <th style={{ width: 100 }}>KIND</th>
            <th className="num" style={{ width: 80 }}>USED</th>
            <th style={{ width: 180 }}>QUOTA</th>
            <th style={{ width: 100 }}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {chain.map((row) => (
            <tr key={`${row.kind}-${row.name}`}>
              <td className="row-key">{row.name}</td>
              <td className="muted">{row.kind}</td>
              <td className="num muted">—</td>
              <td>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div className="zs-bar" style={{ width: 80 }}>
                    <span style={{ width: row.status === "off" ? "0%" : "10%", background: "var(--zs-pos)" }} />
                  </div>
                  <span style={{ fontSize: 10, color: "var(--zs-fg-muted)" }}>—</span>
                </div>
              </td>
              <td>
                <Tag tone={row.status === "ok" ? "pos" : row.status === "warn" ? "amber" : "neg"}>
                  {row.statusLabel}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: "10px 14px", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-fg-muted)" }}>
        Fixtures come from odds-api.io · pasting a football-data.org key adds main leagues via the official API.
      </div>
    </Block>
  );
}

export function ProviderConfigCard({ settings, onUpdate }: Props) {
  const [booksInput, setBooksInput] = useState((settings.userBooks ?? []).join(", "));

  useEffect(() => {
    setBooksInput((settings.userBooks ?? []).join(", "));
  }, [settings.userBooks]);

  const handleBooksBlur = () => {
    const books = booksInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    void onUpdate({ userBooks: books });
  };

  return (
    <Block head="PROVIDER CONFIG">
      <div style={rowStyle}>
        <span style={captionStyle}>ODDSAPI REGION</span>
        <select
          className="zs-input"
          value={settings.oddsRegion}
          onChange={(e) => void onUpdate({ oddsRegion: e.target.value as AppSettings["oddsRegion"] })}
        >
          {REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      <div style={rowStyle}>
        <span style={captionStyle}>SPLITS PROVIDER</span>
        <select
          className="zs-input"
          value={settings.splitProviderId}
          onChange={(e) => void onUpdate({ splitProviderId: e.target.value as SplitProviderId })}
        >
          {SPLIT_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>{SPLIT_PROVIDER_LABEL[id]}</option>
          ))}
        </select>
      </div>

      <div style={rowStyle}>
        <span style={captionStyle}>HISTORY PROVIDER</span>
        <select
          className="zs-input"
          value={settings.historyProviderId}
          onChange={(e) => void onUpdate({ historyProviderId: e.target.value as HistoryProviderId })}
        >
          {HISTORY_PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>{HISTORY_PROVIDER_LABEL[id]}</option>
          ))}
        </select>
      </div>

      <div style={{ ...rowStyle, borderBottom: "none" }}>
        <span style={captionStyle}>BOOKS YOU OPERATE</span>
        <input
          className="zs-input"
          placeholder="Bet365, Sbobet, Unibet  (empty = all books)"
          value={booksInput}
          onChange={(e) => setBooksInput(e.target.value)}
          onBlur={handleBooksBlur}
          style={{ fontFamily: "var(--font-mono)" }}
        />
      </div>

      {(settings.userBooks ?? []).length === 0 && (
        <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-accent)" }}>
          ⚠ No books configured · edge uses best price across all books (phantom edge possible).
        </div>
      )}
    </Block>
  );
}
