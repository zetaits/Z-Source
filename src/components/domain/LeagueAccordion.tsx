import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { findLeagueById } from "@/config/leagues";
import type { CatalogMatch } from "@/domain/match";
import { MatchCard } from "./MatchCard";

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  countryCode: string;
  matches: CatalogMatch[];
}

interface Props {
  groups: LeagueGroup[];
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });

const tierClass = (tier: number | undefined, countryCode: string): "top" | "cont" | "other" => {
  if (countryCode === "EU") return "cont";
  if (tier !== undefined && tier <= 1) return "top";
  return "other";
};

export function LeagueAccordion({ groups }: Props) {
  if (groups.length === 0) return null;

  return (
    <Accordion
      type="multiple"
      defaultValue={groups.slice(0, 3).map((g) => g.leagueId)}
      className="flex flex-col gap-2"
    >
      {groups.map((group) => {
        const def = findLeagueById(group.leagueId);
        const accent = tierClass(def?.tier, group.countryCode);
        const sortedKicks = group.matches
          .map((m) => m.kickoffAt)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const range = sortedKicks.length
          ? `${fmtTime(sortedKicks[0])}–${fmtTime(sortedKicks[sortedKicks.length - 1])}`
          : "";
        return (
          <AccordionItem
            key={group.leagueId}
            value={group.leagueId}
            className="relative overflow-hidden rounded-lg border border-zs"
            style={{ background: "var(--zs-bg-elev)" }}
          >
            <span className={cn("league-accent", accent)} aria-hidden />
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex flex-1 items-center gap-3">
                <span className="pill pill-ghost" style={{ height: 20, fontSize: 10 }}>
                  {group.countryCode}
                </span>
                <span className="text-[14px] font-semibold text-fg">{group.leagueName}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="font-mono text-[11px] tabular-nums text-fg-dim">{range}</span>
                  <span className="pill pill-ghost" style={{ height: 20, fontSize: 10 }}>
                    {group.matches.length} {group.matches.length === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-2 pb-2">
              <ul className="flex flex-col gap-1">
                {group.matches.map((m) => (
                  <li key={`${m.source}-${m.catalogId}`}>
                    <MatchCard match={m} />
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
