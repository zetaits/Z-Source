import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type PaletteId = "amber" | "green" | "red" | "cyan" | "cream";

export interface AccentPalette {
  id: PaletteId;
  label: string;
  accent: string;
  hot: string;
}

export const ACCENT_PALETTES: readonly AccentPalette[] = [
  { id: "amber", label: "AMBER PIT", accent: "#ffb84d", hot: "#ff8c2a" },
  { id: "green", label: "PHOSPHOR",  accent: "#7ad15e", hot: "#5fa847" },
  { id: "red",   label: "BLOOD",     accent: "#ff5040", hot: "#d63a2c" },
  { id: "cyan",  label: "CRT BLUE",  accent: "#7ec8d4", hot: "#5aa6b3" },
  { id: "cream", label: "BONE",      accent: "#e8d9b5", hot: "#c4b48d" },
] as const;

export interface Tweaks {
  palette: PaletteId;
  scanlines: boolean;
}

const DEFAULTS: Tweaks = { palette: "amber", scanlines: true };

const STORAGE_KEY = "zs.tweaks.v2";
const LEGACY_KEY = "zs.tweaks.v1";

const PALETTE_LOOKUP = Object.fromEntries(ACCENT_PALETTES.map((p) => [p.id, p])) as Record<PaletteId, AccentPalette>;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hexToFill(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Returns the shadcn-compatible "H S% L%" triple (no hsl() wrapper). */
function hexToHslTriple(hex: string): string {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function loadTweaks(): Tweaks {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Tweaks>;
    const palette =
      parsed.palette && PALETTE_LOOKUP[parsed.palette] ? parsed.palette : DEFAULTS.palette;
    const scanlines =
      typeof parsed.scanlines === "boolean" ? parsed.scanlines : DEFAULTS.scanlines;
    return { palette, scanlines };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
  scanlines: boolean;
  setScanlines: (on: boolean) => void;
}

const TweaksCtx = createContext<Ctx | null>(null);

export function TweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<Tweaks>(() => loadTweaks());

  useEffect(() => {
    const root = document.documentElement;
    const p = PALETTE_LOOKUP[tweaks.palette] ?? PALETTE_LOOKUP.amber;
    root.style.setProperty("--zs-accent", p.accent);
    root.style.setProperty("--zs-accent-hot", p.hot);
    root.style.setProperty("--zs-accent-fill", hexToFill(p.accent, 0.1));

    // shadcn HSL bridge: keep Button/Card/Tabs/Input/Switch primary tone in sync
    const hsl = hexToHslTriple(p.accent);
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--accent", hsl);
    root.style.setProperty("--ring", hsl);
    root.style.setProperty("--sidebar-primary", hsl);
    root.style.setProperty("--sidebar-ring", hsl);

    document.body.classList.toggle("zs-no-scanlines", !tweaks.scanlines);

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch { /* ignore quota */ }
  }, [tweaks]);

  const ctx = useMemo<Ctx>(
    () => ({
      palette: tweaks.palette,
      setPalette: (id) => setTweaks((t) => ({ ...t, palette: id })),
      scanlines: tweaks.scanlines,
      setScanlines: (on) => setTweaks((t) => ({ ...t, scanlines: on })),
    }),
    [tweaks.palette, tweaks.scanlines],
  );

  return <TweaksCtx.Provider value={ctx}>{children}</TweaksCtx.Provider>;
}

export function useTweaks(): Ctx {
  const ctx = useContext(TweaksCtx);
  if (!ctx) throw new Error("useTweaks must be used inside <TweaksProvider>");
  return ctx;
}
