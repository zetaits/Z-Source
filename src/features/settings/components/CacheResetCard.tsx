import { useState } from "react";
import { Eraser, Loader2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { queryClient } from "@/services/cache/queryClient";
import { getStorage, isPersistentStorage } from "@/storage";

interface Counts {
  matches: number;
  history: number;
  splits: number;
}

const resetDerivedCaches = async (): Promise<Counts> => {
  const db = await getStorage();
  const matches = await db.execute("DELETE FROM matches_cache", []);
  const history = await db.execute("DELETE FROM history_cache", []);
  const splits = await db.execute("DELETE FROM splits_cache", []);
  return {
    matches: matches.rowsAffected ?? 0,
    history: history.rowsAffected ?? 0,
    splits: splits.rowsAffected ?? 0,
  };
};

export function CacheResetCard() {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const enabled = isPersistentStorage();

  const onConfirm = async () => {
    setBusy(true);
    try {
      const counts = await resetDerivedCaches();
      await queryClient.invalidateQueries({ queryKey: ["match"] });
      await queryClient.invalidateQueries({ queryKey: ["analysis"] });
      await queryClient.invalidateQueries({ queryKey: ["scanner"] });
      toast.success("Caches cleared", {
        description: `matches ${counts.matches} · history ${counts.history} · splits ${counts.splits}. Re-open the Scanner to refetch fixtures.`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Reset failed", { description: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card/40 p-5">
      <header className="mb-4 flex items-start gap-3">
        <Eraser className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">Reset derived caches</h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Clears <span className="font-mono">matches_cache</span>, <span className="font-mono">history_cache</span> and
            <span className="font-mono"> splits_cache</span>. Useful after a provider upgrade (e.g. new <span className="font-mono">sofaScoreId</span> fields) or when H2H / form look suspiciously empty.
            Does <em>not</em> touch bets, ledger, snapshots, quotas or resolutions.
          </p>
        </div>
      </header>

      {!enabled && (
        <p className="mb-4 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Requires the Tauri desktop app (persistent storage).
        </p>
      )}

      <AlertDialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" disabled={!enabled} className="gap-2">
            <Eraser className="size-3.5" />
            Clear caches…
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear derived caches?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  All cached fixtures, team form / H2H / intangibles, and public betting splits will be deleted.
                  The next scanner run will refetch from providers.
                </p>
                <p className="rounded border border-border bg-muted/30 p-2 text-[11px] font-mono leading-relaxed">
                  DELETE FROM matches_cache;{"\n"}DELETE FROM history_cache;{"\n"}DELETE FROM splits_cache;
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Bets, ledger, snapshots, match_resolution and providers_quota are preserved.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void onConfirm();
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  Clearing…
                </>
              ) : (
                "Clear caches"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
