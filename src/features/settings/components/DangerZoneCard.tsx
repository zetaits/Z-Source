import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
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
import { clearDemoData, seedDemoData } from "@/features/settings/lib/demoSeed";
import { queryClient } from "@/services/cache/queryClient";
import {
  fetchFdorgWindowFixtures,
  fetchOddsApiIoWindowFixtures,
  fetchSofaRemainingWindowFixtures,
} from "@/services/catalog/windowFixtures";
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

const rowStyle = {
  padding: "12px 14px",
  border: "1px solid var(--zs-neg)",
  background: "var(--zs-neg-fill)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
} as const;

const titleStyle = { fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--zs-neg)" } as const;
const subStyle = { fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--zs-fg-dim)", marginTop: 2 } as const;

export function DangerZoneCard() {
  const [busy, setBusy] = useState<"cache" | "seed" | "clear" | null>(null);
  const [open, setOpen] = useState(false);
  const enabled = isPersistentStorage();

  const onConfirm = async () => {
    setBusy("cache");
    try {
      const counts = await resetDerivedCaches();
      await queryClient.invalidateQueries({ queryKey: ["match"] });
      await queryClient.invalidateQueries({ queryKey: ["analysis"] });
      await queryClient.invalidateQueries({ queryKey: ["scanner"] });
      await queryClient.invalidateQueries({ queryKey: ["commandCenter", "fixtures"] });

      const refetched = await Promise.all([
        fetchFdorgWindowFixtures().catch(() => []),
        fetchOddsApiIoWindowFixtures().catch(() => []),
        fetchSofaRemainingWindowFixtures().catch(() => []),
      ]);
      const repopulated = refetched.reduce((sum, list) => sum + list.length, 0);

      toast.success("Caches cleared", {
        description: `matches ${counts.matches} · history ${counts.history} · splits ${counts.splits}. Refetched ${repopulated} fixtures.`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Reset failed", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const invalidateDemo = async () => {
    await queryClient.invalidateQueries({ queryKey: ["bankroll"] });
    await queryClient.invalidateQueries({ queryKey: ["bets"] });
    await queryClient.invalidateQueries({ queryKey: ["ledger"] });
    await queryClient.invalidateQueries({ queryKey: ["metrics"] });
    await queryClient.invalidateQueries({ queryKey: ["pickOutcomes"] });
    await queryClient.invalidateQueries({ queryKey: ["equity"] });
  };

  const onSeed = async () => {
    setBusy("seed");
    try {
      const { bets } = await seedDemoData();
      await invalidateDemo();
      toast.success("Demo data seeded", {
        description: `${bets} bets · ledger reset to 10 units · pick_outcomes mirrored. Open /bankroll and /metrics for screenshots.`,
      });
    } catch (err) {
      toast.error("Seed failed", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const onClearDemo = async () => {
    setBusy("clear");
    try {
      await clearDemoData();
      await invalidateDemo();
      toast.success("Demo data cleared", {
        description: "Bets, ledger and pick_outcomes with the demo prefix removed.",
      });
    } catch (err) {
      toast.error("Clear failed", { description: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Block head="DANGER ZONE">
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
          Requires the Tauri desktop app (persistent storage).
        </div>
      )}

      <AlertDialog open={open} onOpenChange={(v) => busy === null && setOpen(v)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={rowStyle}>
            <div>
              <div style={titleStyle}>CLEAR DERIVED CACHES</div>
              <div style={subStyle}>
                Wipes matches/history/splits cache · preserves bets, ledger, snapshots, resolutions.
              </div>
            </div>
            <button
              type="button"
              className="zs-btn danger sm"
              disabled={!enabled || busy !== null}
              onClick={() => setOpen(true)}
            >
              WIPE
            </button>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={titleStyle}>SEED DEMO DATA · DEV</div>
              <div style={subStyle}>30 fake settled bets, ledger reset to 10u, mirrored pick_outcomes.</div>
            </div>
            <button
              type="button"
              className="zs-btn danger sm"
              disabled={!enabled || busy !== null}
              onClick={() => void onSeed()}
            >
              {busy === "seed" ? "SEEDING…" : "SEED"}
            </button>
          </div>

          <div style={rowStyle}>
            <div>
              <div style={titleStyle}>CLEAR DEMO DATA · DEV</div>
              <div style={subStyle}>Removes all rows with the demo- prefix.</div>
            </div>
            <button
              type="button"
              className="zs-btn danger sm"
              disabled={!enabled || busy !== null}
              onClick={() => void onClearDemo()}
            >
              {busy === "clear" ? "CLEARING…" : "CLEAR"}
            </button>
          </div>
        </div>

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
            <AlertDialogCancel disabled={busy === "cache"}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "cache"}
              onClick={(e) => {
                e.preventDefault();
                void onConfirm();
              }}
            >
              {busy === "cache" ? "Clearing…" : "Clear caches"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Block>
  );
}
