import type { Intangibles, InjuryNote } from "@/domain/history";
import { cn } from "@/lib/utils";

interface Props {
  homeName: string;
  awayName: string;
  intangibles?: Intangibles;
}

const statusTone = (s: InjuryNote["status"]): string =>
  s === "OUT"
    ? "bg-destructive/15 text-destructive border-destructive/40"
    : s === "DOUBT"
      ? "bg-warning/15 text-warning border-warning/40"
      : "bg-success/15 text-success border-success/40";

const importanceWeight = (i: InjuryNote["importance"]): number =>
  i === "KEY" ? 1 : i === "ROTATION" ? 0.6 : 0.35;

function InjuryList({ title, notes }: { title: string; notes: InjuryNote[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h5 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {title}
      </h5>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reported absences.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {notes
            .slice()
            .sort((a, b) => importanceWeight(b.importance) - importanceWeight(a.importance))
            .map((n, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{n.player}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {n.importance} · {n.position ?? "—"}
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                    statusTone(n.status),
                  )}
                >
                  {n.status}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-md border border-border/70 bg-card/40 px-3 py-2">
      <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export function IntangiblesTab({ homeName, awayName, intangibles }: Props) {
  if (!intangibles) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
        Intangibles load after Run analysis.
      </div>
    );
  }
  const weather = intangibles.weather;
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-lg border bg-card p-5">
        <h4 className="text-sm font-semibold">Rest & congestion</h4>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={`${homeName} rest`} value={`${intangibles.homeRestDays ?? "—"} d`} />
          <Stat label={`${awayName} rest`} value={`${intangibles.awayRestDays ?? "—"} d`} />
          <Stat
            label={`${homeName} congestion`}
            value={`${intangibles.homeCongestion ?? 0}`}
          />
          <Stat
            label={`${awayName} congestion`}
            value={`${intangibles.awayCongestion ?? 0}`}
          />
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h4 className="text-sm font-semibold">Injuries & absences</h4>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <InjuryList title={homeName} notes={intangibles.homeInjuries} />
          <InjuryList title={awayName} notes={intangibles.awayInjuries} />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <h4 className="text-sm font-semibold">Motivation</h4>
          <div className="mt-3 space-y-1.5 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {homeName}
              </span>
              <span>{intangibles.motivation?.home ?? "—"}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {awayName}
              </span>
              <span>{intangibles.motivation?.away ?? "—"}</span>
            </div>
          </div>
        </section>
        <section className="rounded-lg border bg-card p-5">
          <h4 className="text-sm font-semibold">Weather</h4>
          {weather ? (
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Temp" value={weather.tempC !== undefined ? `${weather.tempC}°C` : "—"} />
              <Stat label="Wind" value={weather.windKph !== undefined ? `${weather.windKph} kph` : "—"} />
              <Stat label="Sky" value={weather.condition ?? "—"} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No weather reading.</p>
          )}
        </section>
      </div>
    </div>
  );
}
