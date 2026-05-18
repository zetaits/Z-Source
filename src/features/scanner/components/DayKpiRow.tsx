import { useMemo } from "react";
import { KpiCard } from "@/components/domain/KpiCard";
import type { CatalogMatch } from "@/domain/match";
import { localDayKey } from "@/services/catalog/windowFixtures";

interface Props {
  fixtures: CatalogMatch[];
  offset: number;
  onChange(offset: number): void;
}

interface DayStat {
  offset: number;
  weekday: string;
  count: number;
  leagueCount: number;
  earliest?: string;
  latest?: string;
  hourStrip: boolean[];
}

const OFFSETS = [0, 1, 2, 3];

const targetDate = (offset: number): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

const relLabel = (offset: number): string =>
  offset === 0 ? "TODAY" : `+${offset}D`;

export function DayKpiRow({ fixtures, offset, onChange }: Props) {
  const stats = useMemo<DayStat[]>(() => {
    return OFFSETS.map((o) => {
      const target = localDayKey(targetDate(o));
      const days = fixtures.filter((m) => localDayKey(new Date(m.kickoffAt)) === target);
      const leagues = new Set(days.map((m) => String(m.leagueId)));
      const sortedKicks = days
        .map((m) => m.kickoffAt)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      const hourStrip = new Array(24).fill(false) as boolean[];
      for (const m of days) {
        const h = new Date(m.kickoffAt).getHours();
        if (h >= 0 && h < 24) hourStrip[h] = true;
      }
      return {
        offset: o,
        weekday: targetDate(o).toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
        count: days.length,
        leagueCount: leagues.size,
        earliest: sortedKicks[0],
        latest: sortedKicks[sortedKicks.length - 1],
        hourStrip,
      };
    });
  }, [fixtures]);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => {
        const range = s.earliest && s.latest
          ? `${fmtTime(s.earliest)}–${fmtTime(s.latest)}`
          : "no fixtures";
        const sub = s.count === 0
          ? "no fixtures"
          : `${s.leagueCount} ${s.leagueCount === 1 ? "league" : "leagues"} · ${range}`;
        return (
          <KpiCard
            key={s.offset}
            label={`${s.weekday} · ${relLabel(s.offset)}`}
            main={String(s.count)}
            sub={sub}
            hourStrip={s.hourStrip}
            active={s.offset === offset}
            onClick={() => onChange(s.offset)}
          />
        );
      })}
    </div>
  );
}
