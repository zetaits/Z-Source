import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { TutorialProvider } from "@/features/help/TutorialContext";
import { TutorialTour } from "@/features/help/TutorialTour";
import { TOUR_STEPS } from "@/features/help/tourSteps";
import { SportProvider, useSport } from "@/features/sport/SportContext";
import { Sidebar } from "./Sidebar";

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
    <TutorialProvider totalSteps={TOUR_STEPS.length}>
      <SportProvider>
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
            <ShellContent />
          </div>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
          <TutorialTour />
        </div>
      </SportProvider>
    </TutorialProvider>
  );
}

// Remounts the active page when EITHER the route OR the sport changes, so a
// sport switch re-runs the .zs-page-enter entrance and every screen re-reads
// the new sport's terminology/markets from scratch.
function ShellContent() {
  const location = useLocation();
  const { activeSportId } = useSport();
  return (
    <main className="zs-scroll" style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
      <div
        key={`${activeSportId}:${location.pathname}`}
        className="zs-page-enter"
        style={{ minHeight: "100%" }}
      >
        <Outlet />
      </div>
    </main>
  );
}
