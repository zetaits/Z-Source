import { useRef, useState } from "react";
import { Database, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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

export function DataCard() {
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabled = isPersistentStorage();

  const onExportBets = async () => {
    setBusy("bets");
    try {
      const bets = await betsRepo.list({ limit: 10_000 });
      triggerDownload(
        `z-source-bets-${timestamp()}.csv`,
        betsToCsv(bets),
        "text/csv",
      );
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
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Database className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Data</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Export your bets, ledger and strategy config for backup or analysis. Import bets from a CSV (upsert by bet id).
          </p>
        </div>
      </header>

      {!enabled && (
        <p className="mb-4 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Data actions require the Tauri desktop app (persistent storage).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Export
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!enabled || busy !== null}
            onClick={() => void onExportBets()}
            className="justify-start"
          >
            <Download className="mr-2 size-3.5" />
            Bets (CSV)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!enabled || busy !== null}
            onClick={() => void onExportLedger()}
            className="justify-start"
          >
            <Download className="mr-2 size-3.5" />
            Ledger (JSON)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!enabled || busy !== null}
            onClick={() => void onExportStrategy()}
            className="justify-start"
          >
            <Download className="mr-2 size-3.5" />
            Strategy (JSON)
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Import
          </span>
          <label className="contents">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onFilePicked(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!enabled || busy !== null}
              onClick={() => fileInputRef.current?.click()}
              className="justify-start"
            >
              <Upload className="mr-2 size-3.5" />
              Bets from CSV
            </Button>
          </label>
          <p className="text-[11px] text-muted-foreground">
            Same column layout as the CSV export. Rows are upserted by <span className="font-mono">id</span>; invalid rows are skipped with reasons.
          </p>
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
    </section>
  );
}
