import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  Check,
  CirclePlay,
  Home,
  ListChecks,
  Radar,
  Settings as SettingsIcon,
  Target,
  Wallet,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { findLeagueById } from "@/config/leagues";
import { RULES } from "@/engine/rules";
import type { RuleConfig } from "@/domain/strategy";
import { useStrategy } from "@/features/strategy/hooks/useStrategy";
import { isPersistentStorage } from "@/storage";
import { matchesCacheRepo } from "@/storage/repos/matchesCacheRepo";

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const persistent = isPersistentStorage();
  const { strategy, setRuleConfig } = useStrategy();

  const upcoming = useQuery({
    queryKey: ["palette", "upcoming-matches"],
    queryFn: () => matchesCacheRepo.listUpcoming(50),
    enabled: open && persistent,
    staleTime: 60_000,
  });

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const ruleConfigByRuleId = new Map<string, RuleConfig>(
    (strategy?.rules ?? []).map((r) => [r.ruleId, r]),
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Jump, log, toggle… try “liverpool” or “draw-value”" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate("/"))}>
            <Home className="mr-2 size-4" />
            Command Center
            <CommandShortcut>/</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/scanner"))}>
            <Radar className="mr-2 size-4" />
            Scanner
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/bankroll"))}>
            <Wallet className="mr-2 size-4" />
            Bankroll
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/strategy"))}>
            <Target className="mr-2 size-4" />
            Strategy
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate("/settings"))}>
            <SettingsIcon className="mr-2 size-4" />
            Settings
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem
            disabled={!persistent}
            onSelect={() => run(() => navigate("/bankroll?log=1"))}
          >
            <CirclePlay className="mr-2 size-4" />
            Log a bet
          </CommandItem>
        </CommandGroup>

        {persistent && (upcoming.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jump to match">
              {(upcoming.data ?? []).map((m) => {
                const league = findLeagueById(String(m.leagueId));
                const leagueName = league?.name ?? m.leagueName ?? String(m.leagueId);
                return (
                  <CommandItem
                    key={m.catalogId}
                    value={`${m.home.name} ${m.away.name} ${leagueName}`}
                    onSelect={() => run(() => navigate(`/match/${m.catalogId}`))}
                  >
                    <Activity className="mr-2 size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">
                        {m.home.name} vs {m.away.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {leagueName} · {new Date(m.kickoffAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Toggle rules">
          {RULES.map((rule) => {
            const cfg = ruleConfigByRuleId.get(rule.id);
            const enabled = cfg?.enabled ?? true;
            const weight = cfg?.weight ?? rule.defaultWeight;
            return (
              <CommandItem
                key={rule.id}
                value={`rule ${rule.id} ${rule.description}`}
                disabled={!persistent}
                onSelect={() =>
                  run(() =>
                    setRuleConfig({
                      ruleId: rule.id,
                      enabled: !enabled,
                      weight,
                    }),
                  )
                }
              >
                <ListChecks className="mr-2 size-4 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-mono text-xs">{rule.id}</span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    {rule.description}
                  </span>
                </div>
                {enabled ? (
                  <Check className="ml-2 size-3.5 shrink-0 text-[hsl(var(--success))]" />
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
