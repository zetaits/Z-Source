import type { TeamForm, H2H, FormResult } from "@/domain/history";
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
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex items-baseline justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Last {form.lastN}
        </span>
      </div>
      <FormStrip games={form.games} />
      <div className="grid grid-cols-4 gap-3 text-center">
        <Stat label="PPG" value={form.ppgLast.toFixed(2)} />
        <Stat label="GF / GA" value={`${form.goalsFor}-${form.goalsAgainst}`} sub={`${gd >= 0 ? "+" : ""}${gd} GD`} />
        <Stat label="Clean" value={String(form.cleanSheets)} />
        <Stat label="BTTS" value={`${Math.round(form.bttsRate * 100)}%`} />
      </div>
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

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-baseline justify-between">
          <h4 className="text-sm font-semibold">Head to head</h4>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {h2h ? `${h2h.meetings.length} meetings` : "—"}
          </span>
        </div>
        {h2h ? (
          <div className="mt-3 grid grid-cols-4 gap-3 text-center">
            <Stat label={homeName} value={String(h2h.homeWins)} sub="wins" />
            <Stat label="Draws" value={String(h2h.draws)} />
            <Stat label={awayName} value={String(h2h.awayWins)} sub="wins" />
            <Stat label="Avg Goals" value={h2h.averageGoals.toFixed(2)} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">H2H data unavailable.</p>
        )}
      </div>
    </div>
  );
}
