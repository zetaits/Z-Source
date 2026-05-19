import { useEffect, useRef, useState } from "react";
import { ACCENT_PALETTES, useTweaks } from "./TweaksContext";

export function ThemeMenu() {
  const { palette, setPalette, scanlines, setScanlines } = useTweaks();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = ACCENT_PALETTES.find((p) => p.id === palette) ?? ACCENT_PALETTES[0];

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "stretch" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`Theme · ${current.label}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 14px",
          background: open ? "var(--zs-bg-elev)" : "transparent",
          border: "none",
          borderLeft: "1px solid var(--zs-border)",
          color: "var(--zs-fg-dim)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: "pointer",
          minWidth: 132,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 12,
            height: 12,
            background: current.accent,
            border: "1px solid var(--zs-border-bright)",
          }}
        />
        <span style={{ color: open ? "var(--zs-accent)" : "var(--zs-fg-dim)" }}>THEMES</span>
        <span style={{ marginLeft: "auto", color: "var(--zs-fg-faint)", fontSize: 9 }}>
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            minWidth: 200,
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
            ── ACCENT ──
          </div>
          {ACCENT_PALETTES.map((p) => {
            const active = p.id === palette;
            return (
              <button
                key={p.id}
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setPalette(p.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  background: active ? "var(--zs-surface-2)" : "transparent",
                  border: "1px solid",
                  borderColor: active ? p.accent : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ width: 18, height: 14, background: p.accent }} aria-hidden />
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: active ? p.accent : "var(--zs-fg-dim)",
                    letterSpacing: "0.10em",
                    fontWeight: 600,
                  }}
                >
                  {p.label}
                </span>
                {active && (
                  <span style={{ color: p.accent, fontFamily: "var(--font-mono)", fontSize: 12 }}>▸</span>
                )}
              </button>
            );
          })}

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--zs-fg-muted)",
              letterSpacing: "0.18em",
              padding: "10px 8px 4px",
            }}
          >
            ── CHROME ──
          </div>
          <button
            role="menuitemcheckbox"
            aria-checked={scanlines}
            onClick={() => setScanlines(!scanlines)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              background: "transparent",
              border: "1px solid transparent",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 18,
                height: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--zs-border-bright)",
                color: scanlines ? "var(--zs-accent)" : "transparent",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ×
            </span>
            <span
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: scanlines ? "var(--zs-accent)" : "var(--zs-fg-dim)",
                letterSpacing: "0.10em",
                fontWeight: 600,
              }}
            >
              CRT SCANLINES
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: scanlines ? "var(--zs-accent)" : "var(--zs-fg-faint)",
                letterSpacing: "0.16em",
              }}
            >
              {scanlines ? "ON" : "OFF"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
