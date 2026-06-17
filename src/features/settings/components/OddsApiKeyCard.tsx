import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { Block } from "@/components/zs";
import type { AppSettings } from "@/services/settings/settingsStore";

interface Props {
  settings: AppSettings;
  onUpdate(patch: Partial<AppSettings>): Promise<void>;
}

interface KeyRowProps {
  id: string;
  title: string;
  hint: string;
  placeholder: string;
  current: string | null;
  onSave(value: string | null): Promise<void>;
}

function KeyRow({ id, title, hint, placeholder, current, onSave }: KeyRowProps) {
  const [draft, setDraft] = useState(current ?? "");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = draft !== (current ?? "");

  const save = async () => {
    setBusy(true);
    try {
      await onSave(draft.trim() || null);
      toast.success(`${title} saved`);
    } catch (err) {
      toast.error(`Failed to store ${title}: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <label
          htmlFor={id}
          style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--zs-fg-muted)" }}
        >
          {title}
        </label>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-fg-muted)" }}>{hint}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="zs-input"
          autoComplete="off"
          spellCheck={false}
          style={{ flex: 1, fontFamily: "var(--font-mono)" }}
        />
        <button
          type="button"
          className="zs-btn sm"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide key" : "Show key"}
        >
          {visible ? "HIDE" : "REVEAL"}
        </button>
        <button
          type="button"
          className="zs-btn sm primary"
          onClick={save}
          disabled={!dirty || busy}
        >
          {busy ? "SAVING…" : "SAVE"}
        </button>
      </div>
    </div>
  );
}

export function OddsApiKeyCard({ settings, onUpdate }: Props) {
  return (
    <Block head="ODDS·API KEY · primary feed">
      <KeyRow
        id="odds-api-io-key"
        title="ODDS-API.IO"
        hint="FREE · 100 REQ/H · 34 SPORTS"
        placeholder="paste your odds-api.io key"
        current={settings.oddsApiIoKey}
        onSave={(v) => onUpdate({ oddsApiIoKey: v })}
      />
      <div className="zs-rule" style={{ margin: "14px 0" }} />
      <KeyRow
        id="football-data-key"
        title="FOOTBALL-DATA.ORG"
        hint="FREE · 10 REQ/MIN · MAIN LEAGUES"
        placeholder="paste football-data.org API key"
        current={settings.footballDataApiKey}
        onSave={(v) => onUpdate({ footballDataApiKey: v })}
      />
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--zs-fg-muted)",
          marginTop: 12,
          lineHeight: 1.5,
        }}
      >
        Keys are stored locally · OS keyring via tauri-plugin-store on desktop. Fallback chain tries primary first.
      </div>
    </Block>
  );
}
