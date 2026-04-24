import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Radar,
  Wallet,
  SlidersHorizontal,
  Settings as SettingsIcon,
  FlaskConical,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/features/settings/hooks/useSettings";
import { resolveProviders } from "@/services/providers/factory";
import type { QuotaTracker } from "@/services/http/quotaTracker";
import type { QuotaSnapshot } from "@/services/providers/OddsProvider";

type Group = { label: string; items: readonly NavItemDef[] };
type NavItemDef = { to: string; label: string; icon: LucideIcon; end: boolean };

const WORK: Group = {
  label: "Work",
  items: [
    { to: "/", label: "Command Center", icon: LayoutDashboard, end: true },
    { to: "/scanner", label: "Scanner", icon: Radar, end: false },
  ],
};

const PERFORMANCE: Group = {
  label: "Performance",
  items: [
    { to: "/bankroll", label: "Bankroll", icon: Wallet, end: false },
    { to: "/strategy", label: "Strategy", icon: SlidersHorizontal, end: false },
    { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
  ],
};

const DEV: Group = {
  label: "Dev",
  items: [
    { to: "/__engine-playground", label: "Engine Playground", icon: FlaskConical, end: false },
  ],
};

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-zs bg-zs-bg">
      <LogoBlock />
      <nav className="flex flex-1 flex-col gap-1 p-3 overflow-y-auto">
        <NavGroup group={WORK} />
        <NavGroup group={PERFORMANCE} />
        {import.meta.env.DEV && <NavGroup group={DEV} />}
      </nav>
      <ProviderStrip />
    </aside>
  );
}

function LogoBlock() {
  return (
    <div className="flex h-14 items-center gap-2.5 border-b border-zs px-4">
      <div className="flex size-7 items-center justify-center rounded-md bg-info-fill font-display text-base text-info"
           style={{ border: "1px solid color-mix(in oklch, var(--zs-info) 40%, transparent)" }}>
        Z
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-mono text-[11px] font-semibold tracking-[0.05em] text-fg">
          Z-SOURCE
        </span>
        <span className="font-mono text-[9px] tracking-[0.1em] text-fg-muted">
          EV+ TERMINAL
        </span>
      </div>
    </div>
  );
}

function NavGroup({ group }: { group: Group }) {
  return (
    <>
      <div className="kicker px-2.5 pb-1 pt-2 text-[9px]">{group.label}</div>
      {group.items.map((item) => (
        <NavItem key={item.to} item={item} />
      ))}
    </>
  );
}

function NavItem({ item }: { item: NavItemDef }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
          isActive
            ? "bg-zs-surface text-fg font-medium"
            : "text-fg-dim hover:bg-zs-surface hover:text-fg",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden
              className="absolute -left-3 top-1.5 bottom-1.5 w-0.5 rounded-full"
              style={{ background: "var(--zs-info)" }}
            />
          )}
          <item.icon
            className={cn("size-4 shrink-0", isActive ? "text-info" : "text-fg-muted")}
            aria-hidden
          />
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function ProviderStrip() {
  const { data: settings } = useSettings();
  const trackers = useMemo<QuotaTracker[]>(
    () => (settings ? resolveProviders(settings).quotaTrackers : []),
    [settings],
  );
  if (trackers.length === 0) {
    return (
      <div className="border-t border-zs p-3 font-mono text-[10px] uppercase tracking-wider text-fg-muted">
        v0.1.0 · scaffold
      </div>
    );
  }
  return (
    <div className="border-t border-zs p-3">
      <div className="kicker mb-1.5">Providers</div>
      <div className="flex flex-col gap-0.5">
        {trackers.map((t) => (
          <ProviderRow key={t.providerId} tracker={t} />
        ))}
      </div>
    </div>
  );
}

function ProviderRow({ tracker }: { tracker: QuotaTracker }) {
  const [snap, setSnap] = useState<QuotaSnapshot>(() => tracker.snapshot());
  useEffect(() => tracker.subscribe(setSnap), [tracker]);

  const { tone, display } = useMemo(() => {
    const rem = snap.remaining;
    const cap = tracker.capacity;
    if (rem === null || cap === null) {
      return { tone: "warn" as const, display: "—" };
    }
    const ratio = rem / cap;
    const t: "pos" | "warn" | "neg" = ratio <= 0.1 ? "neg" : ratio <= 0.25 ? "warn" : "pos";
    return { tone: t, display: `${rem}/${cap}` };
  }, [snap, tracker]);

  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-2">
        <span className={cn("ind", `ind-${tone}`)} aria-hidden />
        <span className="font-mono text-[10.5px] text-fg-dim">{tracker.label}</span>
      </div>
      <span className="font-mono text-[10px] tabular-nums text-fg-muted">{display}</span>
    </div>
  );
}
