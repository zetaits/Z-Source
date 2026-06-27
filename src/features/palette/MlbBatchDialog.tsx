import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Activity, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";
import { useMlbLineupStatus } from "@/features/fixtures/useMlbLineupStatus";
import {
  MLB_SPORT_ID,
  prewarmMlbAnalysis,
  selectAnalyzableMlbGames,
  type BatchSummary,
} from "./mlbBatchAnalysis";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

type Phase = "confirm" | "running" | "done";

/**
 * Confirm + run the MLB batch pre-analysis. Lists how many games have lineups
 * posted, warms the analysis cache for each on confirm (so MatchDetail opens
 * pre-analyzed), and shows a progress bar then a one-line summary.
 */
export function MlbBatchDialog({ open, onOpenChange }: Props) {
  const persistent = isPersistentStorage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<BatchSummary | null>(null);

  // Reset to the confirm step every time the dialog reopens.
  useEffect(() => {
    if (open) {
      setPhase("confirm");
      setProgress({ done: 0, total: 0 });
      setSummary(null);
    }
  }, [open]);

  const lineupStatus = useMlbLineupStatus(open && persistent);
  const matches = useQuery({
    queryKey: ["palette", "mlb-batch", "upcoming"],
    queryFn: () => matchesCacheRepo.listUpcoming(200),
    enabled: open && persistent,
    staleTime: 60_000,
  });

  const games = useMemo(
    () => selectAnalyzableMlbGames(matches.data ?? [], lineupStatus),
    [matches.data, lineupStatus],
  );

  const loading = matches.isLoading || (lineupStatus === null && persistent);

  const run = async () => {
    if (games.length === 0) return;
    setPhase("running");
    setProgress({ done: 0, total: games.length });
    const result = await prewarmMlbAnalysis({
      queryClient,
      games,
      sportId: MLB_SPORT_ID,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    setSummary(result);
    setPhase("done");
    toast.success("MLB batch analysis complete", {
      description: `${result.analyzed} analyzed · ${result.withPlays} with plays${result.failed > 0 ? ` · ${result.failed} failed` : ""}`,
    });
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => phase !== "running" && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="size-4" /> Analyze MLB games with lineups
          </DialogTitle>
          <DialogDescription>
            Pre-analyzes every MLB game whose lineup is posted, so each match opens
            already analyzed.
          </DialogDescription>
        </DialogHeader>

        {phase === "confirm" && (
          <div className="py-2 text-sm">
            {loading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Checking lineups…
              </span>
            ) : games.length === 0 ? (
              <span className="text-muted-foreground">
                No MLB games have lineups posted yet. Lineups usually drop ~1–2h before
                first pitch.
              </span>
            ) : (
              <span>
                <strong className="tabnum">{games.length}</strong>{" "}
                {games.length === 1 ? "game has" : "games have"} lineups posted and{" "}
                {games.length === 1 ? "is" : "are"} ready to analyze.
              </span>
            )}
          </div>
        )}

        {phase === "running" && (
          <div className="flex flex-col gap-3 py-2">
            <Progress value={pct} />
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Analyzing {progress.done} /{" "}
              {progress.total}…
            </span>
          </div>
        )}

        {phase === "done" && summary && (
          <div className="py-2 text-sm">
            Done. <strong className="tabnum">{summary.analyzed}</strong> analyzed,{" "}
            <strong className="tabnum">{summary.withPlays}</strong> with plays
            {summary.failed > 0 ? (
              <>
                , <strong className="tabnum">{summary.failed}</strong> failed
              </>
            ) : null}
            . Open any MLB match — it's ready.
          </div>
        )}

        <DialogFooter>
          {phase === "confirm" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={run} disabled={loading || games.length === 0}>
                Analyze {games.length > 0 ? games.length : ""}
              </Button>
            </>
          )}
          {phase === "running" && (
            <Button disabled>
              <Loader2 className="mr-2 size-4 animate-spin" /> Analyzing…
            </Button>
          )}
          {phase === "done" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => { onOpenChange(false); navigate("/scanner"); }}>
                Go to Scanner
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
