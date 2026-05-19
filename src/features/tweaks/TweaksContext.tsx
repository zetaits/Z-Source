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
}

const DEFAULTS: Tweaks = { palette: "amber" };

const STORAGE_KEY = "zs.tweaks.v2";
const LEGACY_KEY = "zs.tweaks.v1";

const PALETTE_LOOKUP = Object.fromEntries(ACCENT_PALETTES.map((p) => [p.id, p])) as Record<PaletteId, AccentPalette>;

function hexToFill(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadTweaks(): Tweaks {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Tweaks>;
    if (parsed.palette && PALETTE_LOOKUP[parsed.palette]) {
      return { palette: parsed.palette };
    }
    return DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  palette: PaletteId;
  setPalette: (id: PaletteId) => void;
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

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch { /* ignore quota */ }
  }, [tweaks]);

  const ctx = useMemo<Ctx>(
    () => ({
      palette: tweaks.palette,
      setPalette: (id) => setTweaks({ palette: id }),
    }),
    [tweaks.palette],
  );

  return <TweaksCtx.Provider value={ctx}>{children}</TweaksCtx.Provider>;
}

export function useTweaks(): Ctx {
  const ctx = useContext(TweaksCtx);
  if (!ctx) throw new Error("useTweaks must be used inside <TweaksProvider>");
  return ctx;
}
