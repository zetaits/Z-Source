import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Radar,
  Wallet,
  SlidersHorizontal,
  Settings as SettingsIcon,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Command Center", icon: LayoutDashboard, end: true },
  { to: "/scanner", label: "Scanner", icon: Radar, end: false },
  { to: "/bankroll", label: "Bankroll", icon: Wallet, end: false },
  { to: "/strategy", label: "Strategy", icon: SlidersHorizontal, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
] as const;

const devItems = [
  { to: "/__engine-playground", label: "Engine Playground", icon: FlaskConical, end: false },
] as const;

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    "text-muted-foreground hover:bg-secondary hover:text-foreground",
    isActive && "bg-secondary text-foreground",
  );

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="size-7 rounded-md bg-primary/15 ring-1 ring-primary/40" />
        <span className="font-mono text-sm font-semibold tracking-tight text-foreground">
          Z-SOURCE
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
        {import.meta.env.DEV && (
          <>
            <div className="mt-4 px-3 pb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
              dev
            </div>
            {devItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                <Icon className="size-4 shrink-0" aria-hidden />
                <span>{label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
      <div className="border-t border-border p-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        v0.1.0 · scaffold
      </div>
    </aside>
  );
}
