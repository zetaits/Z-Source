import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CatalogMatch } from "@/domain/match";
import { MatchRow } from "./MatchRow";

interface LeagueGroup {
  leagueId: string;
  leagueName: string;
  countryCode: string;
  matches: CatalogMatch[];
}

interface Props {
  groups: LeagueGroup[];
}

export function LeagueAccordion({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/30 p-8 text-center">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          no fixtures in window
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Enable more leagues in Settings or pick a different date.
        </p>
      </div>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={groups.slice(0, 3).map((g) => g.leagueId)} className="flex flex-col gap-2">
      {groups.map((group) => (
        <AccordionItem
          key={group.leagueId}
          value={group.leagueId}
          className="rounded-lg border border-border bg-card/30 px-4"
        >
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {group.countryCode}
              </span>
              <span className="text-sm font-medium">{group.leagueName}</span>
              <span className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                {group.matches.length}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <ul className="flex flex-col gap-0.5">
              {group.matches.map((m) => (
                <li key={`${m.source}-${m.catalogId}`}>
                  <MatchRow match={m} />
                </li>
              ))}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
