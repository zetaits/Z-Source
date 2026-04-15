import type { H2H, TeamForm } from "@/domain/history";

interface Props {
  homeName: string;
  awayName: string;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
}

const totalGoalsPerGame = (f?: TeamForm): number =>
  !f || f.lastN === 0 ? 0 : (f.goalsFor + f.goalsAgainst) / f.lastN;

function TrendRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-2 last:border-0">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <span className="font-mono text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function TrendsTab({ homeName, awayName, homeForm, awayForm, h2h }: Props) {
  if (!homeForm && !awayForm && !h2h) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        Run analysis to load trend signals.
      </div>
    );
  }

  const combinedTotal = (totalGoalsPerGame(homeForm) + totalGoalsPerGame(awayForm)) / 2;
  const combinedBtts = homeForm && awayForm ? (homeForm.bttsRate + awayForm.bttsRate) / 2 : undefined;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border bg-card p-5">
        <h4 className="text-sm font-semibold">Goal trends</h4>
        <div className="mt-2">
          <TrendRow
            label={`${homeName} total goals / game`}
            value={totalGoalsPerGame(homeForm).toFixed(2)}
            hint={homeForm ? `Last ${homeForm.lastN}` : undefined}
          />
          <TrendRow
            label={`${awayName} total goals / game`}
            value={totalGoalsPerGame(awayForm).toFixed(2)}
            hint={awayForm ? `Last ${awayForm.lastN}` : undefined}
          />
          <TrendRow
            label="Combined avg"
            value={combinedTotal.toFixed(2)}
            hint="Blend of both teams' scoring rate"
          />
          <TrendRow
            label="H2H avg goals"
            value={h2h ? h2h.averageGoals.toFixed(2) : "—"}
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h4 className="text-sm font-semibold">BTTS & clean sheets</h4>
        <div className="mt-2">
          <TrendRow
            label={`${homeName} BTTS rate`}
            value={homeForm ? `${Math.round(homeForm.bttsRate * 100)}%` : "—"}
          />
          <TrendRow
            label={`${awayName} BTTS rate`}
            value={awayForm ? `${Math.round(awayForm.bttsRate * 100)}%` : "—"}
          />
          <TrendRow
            label="Combined BTTS"
            value={combinedBtts === undefined ? "—" : `${Math.round(combinedBtts * 100)}%`}
          />
          <TrendRow
            label="Clean sheets"
            value={
              homeForm && awayForm
                ? `${homeForm.cleanSheets} vs ${awayForm.cleanSheets}`
                : "—"
            }
          />
        </div>
      </section>
    </div>
  );
}
