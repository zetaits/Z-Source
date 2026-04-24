import type { TeamForm, TeamFormGame, H2H, FormResult } from "@/domain/history";
import { cn } from "@/lib/utils";

interface Props {
  homeName: string;
  awayName: string;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
}

const resultTone = (r: FormResult): string =>
  r === "W"
    ? "bg-success/15 text-success border-success/40"
    : r === "D"
      ? "bg-muted text-muted-foreground border-border"
      : "bg-destructive/15 text-destructive border-destructive/40";

const venueTone = (isHome: boolean): string =>
  isHome
    ? "bg-primary/10 text-primary border-primary/40"
    : "bg-amber-500/10 text-amber-500 border-amber-500/40";

const shortDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
};

function FormStrip({ games }: { games: TeamForm["games"] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {games.map((g, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex size-6 items-center justify-center rounded border text-[10px] font-mono font-semibold",
            resultTone(g.result),
          )}
          title={`${g.isHome ? "H" : "A"} vs ${g.opponentName} · ${g.goalsFor}-${g.goalsAgainst}`}
        >
          {g.result}
        </span>
      ))}
    </div>
  );
}

function GameRow({ game }: { game: TeamFormGame }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded border font-mono text-[10px] font-semibold",
          venueTone(game.isHome),
        )}
        title={game.isHome ? "Home fixture" : "Away fixture"}
      >
        {game.isHome ? "H" : "A"}
      </span>
      <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">
        {shortDate(game.date)}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {game.opponentName}
      </span>
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
        {game.goalsFor}–{game.goalsAgainst}
      </span>
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-semibold",
          resultTone(game.result),
        )}
      >
        {game.result}
      </span>
    </div>
  );
}

function GameList({ games }: { games: TeamFormGame[] }) {
  if (games.length === 0) {
    return <p className="text-xs text-muted-foreground">No recent matches.</p>;
  }
  return (
    <ul className="divide-y divide-border/40">
      {games.map((g, i) => (
        <li key={i}>
          <GameRow game={g} />
        </li>
      ))}
    </ul>
  );
}

function FormCard({ title, form }: { title: string; form?: TeamForm }) {
  if (!form) {
    return (
      <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
        {title} — form unavailable.
      </div>
    );
  }
  const gd = form.goalsFor - form.goalsAgainst;
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Last {form.lastN}
        </span>
      </div>
      <FormStrip games={form.games} />
      <div className="grid grid-cols-4 gap-3 text-center">
        <Stat label="PPG" value={form.ppgLast.toFixed(2)} />
        <Stat
          label="GF / GA"
          value={`${form.goalsFor}-${form.goalsAgainst}`}
          sub={`${gd >= 0 ? "+" : ""}${gd} GD`}
        />
        <Stat label="Clean" value={String(form.cleanSheets)} />
        <Stat label="BTTS" value={`${Math.round(form.bttsRate * 100)}%`} />
      </div>
      <div className="border-t border-border/40 pt-3">
        <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          Recent matches
        </div>
        <GameList games={form.games} />
      </div>
    </div>
  );
}

function H2HRow({
  meeting,
  homeName,
  awayName,
}: {
  meeting: TeamFormGame;
  homeName: string;
  awayName: string;
}) {
  const leftName = meeting.isHome ? homeName : awayName;
  const rightName = meeting.isHome ? awayName : homeName;
  const leftGoals = meeting.isHome ? meeting.goalsFor : meeting.goalsAgainst;
  const rightGoals = meeting.isHome ? meeting.goalsAgainst : meeting.goalsFor;
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs">
      <span className="w-12 shrink-0 font-mono text-[10px] text-muted-foreground">
        {shortDate(meeting.date)}
      </span>
      <span className="min-w-0 flex-1 truncate text-right text-foreground">
        {leftName}
      </span>
      <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
        {leftGoals}–{rightGoals}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">
        {rightName}
      </span>
      <span
        className={cn(
          "inline-flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-semibold",
          resultTone(meeting.result),
        )}
        title={`${homeName} perspective: ${meeting.result}`}
      >
        {meeting.result}
      </span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums">{value}</span>
      {sub && (
        <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{sub}</span>
      )}
    </div>
  );
}

export function MatchupTab({ homeName, awayName, homeForm, awayForm, h2h }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <FormCard title={homeName} form={homeForm} />
        <FormCard title={awayName} form={awayForm} />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold">Head to head</h4>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {h2h ? `${h2h.meetings.length} meetings` : "—"}
          </span>
        </div>
        {h2h ? (
          <>
            <div className="grid grid-cols-4 gap-3 text-center">
              <Stat label={homeName} value={String(h2h.homeWins)} sub="wins" />
              <Stat label="Draws" value={String(h2h.draws)} />
              <Stat label={awayName} value={String(h2h.awayWins)} sub="wins" />
              <Stat label="Avg Goals" value={h2h.averageGoals.toFixed(2)} />
            </div>
            {h2h.meetings.length > 0 && (
              <div className="border-t border-border/40 pt-3">
                <div className="mb-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  Past meetings
                </div>
                <ul className="divide-y divide-border/40">
                  {h2h.meetings.map((m, i) => (
                    <li key={i}>
                      <H2HRow meeting={m} homeName={homeName} awayName={awayName} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">H2H data unavailable.</p>
        )}
      </div>
    </div>
  );
}
