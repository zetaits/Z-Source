import { useState } from "react";
import type { TeamForm, TeamFormGame, H2H, FormResult } from "@/domain/history";
import { cn } from "@/lib/utils";

interface Props {
  homeName: string;
  awayName: string;
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2H;
}

type Perspective = "home" | "neutral" | "away";

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

const shortYearDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.valueOf())) return "—";
  return d
    .toLocaleDateString(undefined, { month: "short", year: "2-digit" })
    .replace(",", "");
};

const lastWord = (name: string): string => name.split(" ").slice(-1)[0];

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

interface H2HOutcome {
  label: string;
  toneVar: string;
  toneFill: string;
  borderColor: string;
}

const TONE_VARS: Record<string, { fg: string; fill: string }> = {
  pos: { fg: "var(--zs-pos)", fill: "var(--zs-pos-fill)" },
  neg: { fg: "var(--zs-neg)", fill: "var(--zs-neg-fill)" },
  info: { fg: "var(--zs-info)", fill: "var(--zs-info-fill)" },
  warn: { fg: "var(--zs-warn)", fill: "var(--zs-warn-fill)" },
  muted: { fg: "var(--zs-fg-muted)", fill: "var(--zs-surface)" },
};

const buildOutcome = (
  perspective: Perspective,
  homeWonThatDay: boolean,
  awayWonThatDay: boolean,
  homeThatDayName: string,
  awayThatDayName: string,
  currentHomeName: string,
  currentAwayName: string,
  resultFromCurrentHome: FormResult,
): H2HOutcome => {
  let tone: keyof typeof TONE_VARS;
  let label: string;

  if (perspective === "neutral") {
    if (homeWonThatDay) {
      tone = "info";
      label = `${lastWord(homeThatDayName)} won`;
    } else if (awayWonThatDay) {
      tone = "warn";
      label = `${lastWord(awayThatDayName)} won`;
    } else {
      tone = "muted";
      label = "Draw";
    }
  } else {
    const focus = perspective === "home" ? currentHomeName : currentAwayName;
    const focusIsCurrentHome = focus === currentHomeName;
    // resultFromCurrentHome is W/D/L from currentHome POV.
    const focusResult: FormResult = focusIsCurrentHome
      ? resultFromCurrentHome
      : resultFromCurrentHome === "W"
        ? "L"
        : resultFromCurrentHome === "L"
          ? "W"
          : "D";
    if (focusResult === "W") {
      tone = "pos";
      label = "W";
    } else if (focusResult === "L") {
      tone = "neg";
      label = "L";
    } else {
      tone = "muted";
      label = "D";
    }
  }
  const { fg, fill } = TONE_VARS[tone];
  return {
    label,
    toneVar: fg,
    toneFill: fill,
    borderColor: `color-mix(in oklch, ${fg} 40%, transparent)`,
  };
};

function H2HMeetingRow({
  meeting,
  homeName,
  awayName,
  perspective,
  isLast,
}: {
  meeting: TeamFormGame;
  homeName: string;
  awayName: string;
  perspective: Perspective;
  isLast: boolean;
}) {
  // Resolve who actually played at home that day vs away that day.
  const homeThatDayName = meeting.isHome ? homeName : awayName;
  const awayThatDayName = meeting.isHome ? awayName : homeName;
  const homeThatDayGoals = meeting.isHome ? meeting.goalsFor : meeting.goalsAgainst;
  const awayThatDayGoals = meeting.isHome ? meeting.goalsAgainst : meeting.goalsFor;
  const homeWon = homeThatDayGoals > awayThatDayGoals;
  const awayWon = awayThatDayGoals > homeThatDayGoals;

  const outcome = buildOutcome(
    perspective,
    homeWon,
    awayWon,
    homeThatDayName,
    awayThatDayName,
    homeName,
    awayName,
    meeting.result,
  );

  return (
    <div
      className="h2h-row"
      style={{
        borderBottom: isLast
          ? "none"
          : "1px solid color-mix(in oklch, var(--zs-border) 50%, transparent)",
      }}
    >
      <span className="h2h-date">{shortYearDate(meeting.date)}</span>
      <div
        className={cn(
          "h2h-team right",
          homeWon && "winner",
          awayWon && "loser",
        )}
      >
        <span className="crest" aria-hidden />
        <span className="name">{homeThatDayName}</span>
      </div>
      <div className="h2h-score">
        <span style={{ color: homeWon ? "var(--zs-fg)" : "var(--zs-fg-muted)" }}>
          {homeThatDayGoals}
        </span>
        <span style={{ color: "var(--zs-fg-muted)", margin: "0 6px" }}>–</span>
        <span style={{ color: awayWon ? "var(--zs-fg)" : "var(--zs-fg-muted)" }}>
          {awayThatDayGoals}
        </span>
      </div>
      <div
        className={cn(
          "h2h-team",
          awayWon && "winner",
          homeWon && "loser",
        )}
      >
        <span className="crest" aria-hidden />
        <span className="name">{awayThatDayName}</span>
      </div>
      <div className="flex justify-end">
        <span
          className="h2h-outcome"
          style={{
            color: outcome.toneVar,
            background: outcome.toneFill,
            borderColor: outcome.borderColor,
          }}
        >
          {outcome.label}
        </span>
      </div>
    </div>
  );
}

function H2HBlock({
  homeName,
  awayName,
  h2h,
}: {
  homeName: string;
  awayName: string;
  h2h: H2H;
}) {
  const [perspective, setPerspective] = useState<Perspective>("neutral");

  const total = h2h.meetings.length;
  const homePct = total > 0 ? Math.round((h2h.homeWins / total) * 100) : 0;
  const drawPct = total > 0 ? Math.round((h2h.draws / total) * 100) : 0;
  const awayPct = total > 0 ? Math.round((h2h.awayWins / total) * 100) : 0;

  // For the share bar in 'away' perspective we visually flip the segments.
  const flipped = perspective === "away";
  const leftPct = flipped ? awayPct : homePct;
  const rightPct = flipped ? homePct : awayPct;
  const leftWinsValue = flipped ? h2h.awayWins : h2h.homeWins;
  const rightWinsValue = flipped ? h2h.homeWins : h2h.awayWins;
  const leftWinsName = flipped ? awayName : homeName;
  const rightWinsName = flipped ? homeName : awayName;

  return (
    <div
      className="overflow-hidden rounded-lg border border-zs"
      style={{ background: "var(--zs-bg-elev)" }}
    >
      <div
        className="flex items-center justify-between border-b border-zs px-4 py-3"
        style={{ flexWrap: "wrap", gap: 12 }}
      >
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold">Head to head</h4>
          <span className="kicker">last {total} meetings</span>
        </div>

        {/* Perspective toggle */}
        <div className="flex items-center gap-2">
          <span className="kicker">From perspective of</span>
          <div
            className="inline-flex rounded-md border border-zs p-0.5"
            style={{ background: "var(--zs-surface)" }}
            role="tablist"
            aria-label="H2H perspective"
          >
            {(
              [
                { k: "home", l: homeName },
                { k: "neutral", l: "Neutral" },
                { k: "away", l: awayName },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                type="button"
                role="tab"
                aria-selected={perspective === o.k}
                onClick={() => setPerspective(o.k)}
                className="rounded font-mono"
                style={{
                  border: "none",
                  background:
                    perspective === o.k ? "var(--zs-bg-elev)" : "transparent",
                  color:
                    perspective === o.k
                      ? "var(--zs-fg)"
                      : "var(--zs-fg-muted)",
                  fontSize: 11,
                  padding: "5px 10px",
                  cursor: "pointer",
                }}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {total > 0 && (
        <>
          <div className="px-4 pt-3">
            <div className="mb-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-4 text-[13px]">
                <span
                  className="font-mono tabular-nums"
                  style={{ color: "var(--zs-info)" }}
                >
                  {leftWinsValue} wins{" "}
                  <span className="text-fg-muted">{leftWinsName}</span>
                </span>
                <span className="font-mono tabular-nums text-fg-muted">
                  {h2h.draws} draws
                </span>
                <span
                  className="font-mono tabular-nums"
                  style={{ color: "var(--zs-warn)" }}
                >
                  {rightWinsValue} wins{" "}
                  <span className="text-fg-muted">{rightWinsName}</span>
                </span>
              </div>
              <span className="kicker">avg goals {h2h.averageGoals.toFixed(2)}</span>
            </div>
            <div
              className="share-bar"
              style={
                {
                  "--home-pct": `${leftPct}%`,
                  "--draw-pct": `${drawPct}%`,
                  "--away-pct": `${rightPct}%`,
                } as React.CSSProperties
              }
            >
              <span /> <span /> <span />
            </div>
          </div>

          <div className="pt-3">
            <div
              className="grid gap-3 px-4 pb-1.5 border-b border-zs"
              style={{ gridTemplateColumns: "60px 1fr 100px 1fr 90px" }}
            >
              <span className="kicker">Date</span>
              <span className="kicker text-right">Home that day</span>
              <span className="kicker text-center">Score</span>
              <span className="kicker">Away that day</span>
              <span
                className="kicker"
                style={{ textAlign: "right" }}
              >
                Result
              </span>
            </div>
            {h2h.meetings.map((m, i) => (
              <H2HMeetingRow
                key={i}
                meeting={m}
                homeName={homeName}
                awayName={awayName}
                perspective={perspective}
                isLast={i === h2h.meetings.length - 1}
              />
            ))}
          </div>
        </>
      )}

      {total === 0 && (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          No previous meetings.
        </p>
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

      {h2h ? (
        <H2HBlock homeName={homeName} awayName={awayName} h2h={h2h} />
      ) : (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          H2H data unavailable.
        </div>
      )}
    </div>
  );
}
