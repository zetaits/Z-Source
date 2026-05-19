import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Ticker } from "./Ticker";

const ROUTE_BY_KEY: Record<string, string> = {
  "1": "/",
  "2": "/scanner",
  "3": "/bankroll",
  "4": "/metrics",
  "5": "/strategy",
  "6": "/settings",
};

function shouldIgnoreKey(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function AppShell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (shouldIgnoreKey(e.target)) return;

      const route = ROUTE_BY_KEY[e.key];
      if (route) {
        e.preventDefault();
        navigate(route);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div
      style={{
        display: "flex",
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        background: "var(--zs-bg)",
        color: "var(--zs-fg)",
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar onOpenPalette={() => setPaletteOpen(true)} />
        <Ticker />
        <main className="zs-scroll" style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
