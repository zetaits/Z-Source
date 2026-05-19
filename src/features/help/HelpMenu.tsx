import { useEffect, useRef, useState } from "react";
import { HelpCircle, BookOpen, PlayCircle } from "lucide-react";
import { MethodologyDialog } from "./MethodologyDialog";
import { useTutorial } from "./TutorialContext";

const SEEN_KEY = "zs.help.opened";

function readSeen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSeen(): void {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function HelpMenu() {
  const [open, setOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [seen, setSeen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const { startTour } = useTutorial();

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!seen) {
      markSeen();
      setSeen(true);
    }
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, seen]);

  const handleMethodology = () => {
    setOpen(false);
    setMethodologyOpen(true);
  };

  const handleTutorial = () => {
    setOpen(false);
    startTour();
  };

  return (
    <>
      <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Help"
          title="Help"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 46,
            background: open ? "var(--zs-bg-elev)" : "transparent",
            border: "none",
            borderLeft: "1px solid var(--zs-border)",
            color: open ? "var(--zs-accent)" : "var(--zs-fg-dim)",
            cursor: "pointer",
            position: "relative",
          }}
        >
          <HelpCircle size={16} strokeWidth={1.8} />
          {!seen && (
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 6,
                height: 6,
                background: "var(--zs-accent)",
                borderRadius: "50%",
                boxShadow: "0 0 6px var(--zs-accent)",
              }}
            />
          )}
        </button>

        {open && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              minWidth: 240,
              background: "var(--zs-bg)",
              border: "1px solid var(--zs-accent)",
              zIndex: 80,
              padding: 6,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--zs-fg-muted)",
                letterSpacing: "0.18em",
                padding: "6px 8px 4px",
              }}
            >
              ── LEARN ──
            </div>
            <button
              role="menuitem"
              onClick={handleMethodology}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                background: "transparent",
                border: "1px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--zs-fg-dim)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--zs-bg-elev)";
                e.currentTarget.style.borderColor = "var(--zs-accent)";
                e.currentTarget.style.color = "var(--zs-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.color = "var(--zs-fg-dim)";
              }}
            >
              <BookOpen size={14} strokeWidth={1.8} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.10em",
                    fontWeight: 600,
                  }}
                >
                  METHODOLOGY
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--zs-fg-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  How the engine scores picks
                </span>
              </div>
            </button>
            <button
              role="menuitem"
              onClick={handleTutorial}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 10px",
                background: "transparent",
                border: "1px solid transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "var(--zs-fg-dim)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--zs-bg-elev)";
                e.currentTarget.style.borderColor = "var(--zs-accent)";
                e.currentTarget.style.color = "var(--zs-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.color = "var(--zs-fg-dim)";
              }}
            >
              <PlayCircle size={14} strokeWidth={1.8} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.10em",
                    fontWeight: 600,
                  }}
                >
                  TUTORIAL
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--zs-fg-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  30-sec tour · 6 stops
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
      <MethodologyDialog open={methodologyOpen} onOpenChange={setMethodologyOpen} />
    </>
  );
}
