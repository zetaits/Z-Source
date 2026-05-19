import { useState } from "react";
import { FlaskConical, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearDemoData, seedDemoData } from "@/features/settings/lib/demoSeed";
import { queryClient } from "@/services/cache/queryClient";
import { isPersistentStorage } from "@/storage";

export function DemoSeedCard() {
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const enabled = isPersistentStorage();

  const invalidateAll = async () => {
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
      await invalidateAll();
      toast.success("Demo data seeded", {
        description: `${bets} bets · ledger reset to 10 units · pick_outcomes mirrored. Open /bankroll and /metrics for screenshots.`,
      });
    } catch (err) {
      toast.error("Seed failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const onClear = async () => {
    setBusy("clear");
    try {
      await clearDemoData();
      await invalidateAll();
      toast.success("Demo data cleared", {
        description: "Bets, ledger and pick_outcomes with the demo prefix removed.",
      });
    } catch (err) {
      toast.error("Clear failed", { description: (err as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-lg border border-dashed border-info/40 bg-info/5 p-5">
      <header className="mb-4 flex items-start gap-3">
        <FlaskConical className="mt-0.5 size-4 text-info" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold">
            Demo data <span className="ml-1 text-[10px] font-mono uppercase tracking-wider text-info">dev only</span>
          </h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Inserts 30 fake settled bets distributed across the last 45 days with a positive equity curve, plus matching
            <span className="font-mono"> pick_outcomes</span> rows so <span className="font-mono">/bankroll</span> and
            <span className="font-mono"> /metrics</span> are populated for screenshots. All rows are prefixed
            <span className="font-mono"> demo-</span> and can be wiped with <em>Clear</em>.
          </p>
        </div>
      </header>

      {!enabled && (
        <p className="mb-4 rounded border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Requires the Tauri desktop app (persistent storage).
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!enabled || busy !== null}
          onClick={() => void onSeed()}
          className="gap-2"
        >
          {busy === "seed" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Seeding…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" />
              Seed demo data
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!enabled || busy !== null}
          onClick={() => void onClear()}
          className="gap-2"
        >
          {busy === "clear" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Clearing…
            </>
          ) : (
            <>
              <Trash2 className="size-3.5" />
              Clear demo data
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
