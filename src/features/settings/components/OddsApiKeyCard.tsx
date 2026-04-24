import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
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
      toast.error(`Failed to store ${title}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-2 rounded border border-border/60 bg-background/40 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id} className="text-xs uppercase tracking-wider text-muted-foreground">
          {title}
        </Label>
        <span className="text-[10px] text-muted-foreground/80">{hint}</span>
      </div>
      <div className="flex gap-2">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide key" : "Show key"}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
        <Button type="button" onClick={save} disabled={!dirty || busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function OddsApiKeyCard({ settings, onUpdate }: Props) {
  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <KeyRound className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Odds provider keys</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Z-Source tries the primary provider first and falls back on errors. Configure at least one.
            Keys are stored locally (OS keyring on desktop via tauri-plugin-store).
          </p>
        </div>
      </header>

      <div className="grid gap-3">
        <KeyRow
          id="odds-api-io-key"
          title="odds-api.io"
          hint="Free · 100 req/h · 34 sports"
          placeholder="paste your odds-api.io key"
          current={settings.oddsApiIoKey}
          onSave={(v) => onUpdate({ oddsApiIoKey: v })}
        />
        <KeyRow
          id="the-odds-api-key"
          title="the-odds-api.com"
          hint="Free · 500 req/month"
          placeholder="paste your the-odds-api.com key"
          current={settings.oddsApiKey}
          onSave={(v) => onUpdate({ oddsApiKey: v })}
        />
      </div>
    </section>
  );
}
