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

export function OddsApiKeyCard({ settings, onUpdate }: Props) {
  const [draft, setDraft] = useState(settings.oddsApiKey ?? "");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = draft !== (settings.oddsApiKey ?? "");

  const save = async () => {
    setBusy(true);
    try {
      await onUpdate({ oddsApiKey: draft.trim() || null });
      toast.success("API key stored");
    } catch (err) {
      toast.error(`Failed to store key: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <KeyRound className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">OddsAPI key</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Free tier · 500 requests / month. Used <strong>only</strong> for prices and lines, never for listing fixtures.
            Stored locally via the OS keyring (tauri-plugin-store) on desktop.
          </p>
        </div>
      </header>

      <div className="grid gap-2">
        <Label htmlFor="odds-key" className="text-xs uppercase tracking-wider text-muted-foreground">
          API key
        </Label>
        <div className="flex gap-2">
          <Input
            id="odds-key"
            type={visible ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="paste your the-odds-api.com key"
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
    </section>
  );
}
