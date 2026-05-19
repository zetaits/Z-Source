import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Block } from "@/components/zs";
import { loadStrategy } from "@/features/match-detail/hooks/loadStrategy";
import {
  betsToCsv,
  csvToBets,
  ledgerToJson,
  readFileAsText,
  strategyToJson,
  triggerDownload,
} from "@/lib/dataExport";
import { isPersistentStorage } from "@/storage";
import { bankrollRepo } from "@/storage/repos/bankrollRepo";
import { betsRepo } from "@/storage/repos/betsRepo";

const timestamp = () => new Date().toISOString().replace(/[:.]/g, "-");

interface ImportPreview {
  file: File;
  betCount: number;
  errors: { line: number; message: string }[];
}

const rowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid var(--zs-rule)",
  gap: 12,
} as const;

const titleStyle = { fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--zs-fg)", textTransform: "uppercase", letterSpacing: "0.08em" } as const;
const subStyle = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-fg-muted)", marginTop: 2 } as const;

export function DataCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const enabled = isPersistentStorage();

  const onExportBets = async () => {
    setBusy("bets");
    try {
      const bets = await betsRepo.list({ limit: 10_000 });
      triggerDownload(`z-source-bets-${timestamp()}.csv`, betsToCsv(bets), "text/csv");
      toast.success(`Exported ${bets.length} bets`);
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onExportLedger = async () => {
    setBusy("ledger");
    try {
      const [entries, settings] = await Promise.all([
        bankrollRepo.listLedger(100_000),
        bankrollRepo.loadSettings(),
      ]);
      triggerDownload(
        `z-source-ledger-${timestamp()}.json`,
        ledgerToJson(entries, settings),
        "application/json",
      );
      toast.success(`Exported ${entries.length} ledger entries`);
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onExportStrategy = async () => {
    setBusy("strategy");
    try {
      const strategy = await loadStrategy();
      triggerDownload(
        `z-source-strategy-${timestamp()}.json`,
        strategyToJson(strategy),
        "application/json",
      );
      toast.success("Exported strategy config");
    } catch (err) {
      toast.error("Export failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onFilePicked = async (file: File) => {
    try {
      const text = await readFileAsText(file);
      const { bets, errors } = csvToBets(text);
      if (bets.length === 0 && errors.length === 0) {
        toast.warning("CSV has no rows to import");
        return;
      }
      setPreview({ file, betCount: bets.length, errors });
    } catch (err) {
      toast.error("Could not read file", { description: (err as Error).message });
    }
  };

  const confirmImport = async () => {
    if (!preview) return;
    setBusy("import");
    try {
      const text = await readFileAsText(preview.file);
      const { bets } = csvToBets(text);
      let inserted = 0;
      let updated = 0;
      for (const bet of bets) {
        const result = await betsRepo.upsert(bet);
        if (result === "inserted") inserted++;
        else updated++;
      }
      toast.success(`Imported bets`, {
        description: `${inserted} new · ${updated} updated${preview.errors.length ? ` · ${preview.errors.length} skipped` : ""}`,
      });
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.error("Import failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Block head="DATA · IMPORT / EXPORT">
      {!enabled && (
        <div
          style={{
            padding: "10px 12px",
            border: "1px solid var(--zs-accent)",
            background: "var(--zs-accent-fill)",
            color: "var(--zs-fg)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            marginBottom: 12,
          }}
        >
          Data actions require the Tauri desktop app (persistent storage).
        </div>
      )}

      <div>
        <div style={rowStyle}>
          <div>
            <div style={titleStyle}>BETS · CSV</div>
            <div style={subStyle}>Full bet history with stake, odds, status, P/L.</div>
          </div>
          <button
            type="button"
            className="zs-btn sm"
            disabled={!enabled || busy !== null}
            onClick={() => void onExportBets()}
          >
            ↓ CSV
          </button>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={titleStyle}>LEDGER · JSON</div>
            <div style={subStyle}>All ledger entries + bankroll settings (currency, unit size).</div>
          </div>
          <button
            type="button"
            className="zs-btn sm"
            disabled={!enabled || busy !== null}
            onClick={() => void onExportLedger()}
          >
            ↓ JSON
          </button>
        </div>

        <div style={rowStyle}>
          <div>
            <div style={titleStyle}>STRATEGY · JSON</div>
            <div style={subStyle}>Stake policy, leg weights, rule config, markets, combo policy.</div>
          </div>
          <button
            type="button"
            className="zs-btn sm"
            disabled={!enabled || busy !== null}
            onClick={() => void onExportStrategy()}
          >
            ↓ JSON
          </button>
        </div>

        <div style={{ ...rowStyle, borderBottom: "none" }}>
          <div>
            <div style={titleStyle}>IMPORT BETS · CSV</div>
            <div style={subStyle}>
              Same column layout as the export. Rows are upserted by <span style={{ color: "var(--zs-fg)" }}>id</span>; invalid rows are skipped.
            </div>
          </div>
          <label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFilePicked(file);
              }}
            />
            <button
              type="button"
              className="zs-btn sm"
              disabled={!enabled || busy !== null}
              onClick={() => fileInputRef.current?.click()}
            >
              ↑ FILE
            </button>
          </label>
        </div>
      </div>

      <AlertDialog open={preview !== null} onOpenChange={(v) => !v && setPreview(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import {preview?.betCount ?? 0} bets?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Rows with matching <span className="font-mono">id</span> will be overwritten.
                </p>
                {preview && preview.errors.length > 0 ? (
                  <div className="max-h-40 overflow-auto rounded border border-border bg-muted/30 p-2 text-[11px] font-mono">
                    <p className="mb-1 text-warning">
                      {preview.errors.length} row{preview.errors.length === 1 ? "" : "s"} will be skipped:
                    </p>
                    {preview.errors.slice(0, 10).map((e) => (
                      <div key={`${e.line}-${e.message}`} className="text-muted-foreground">
                        Line {e.line}: {e.message}
                      </div>
                    ))}
                    {preview.errors.length > 10 ? (
                      <div className="text-muted-foreground">
                        …and {preview.errors.length - 10} more.
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null || preview?.betCount === 0}
              onClick={(e) => {
                e.preventDefault();
                void confirmImport();
              }}
            >
              Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Block>
  );
}
