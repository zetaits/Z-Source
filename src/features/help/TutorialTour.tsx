import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFixturesWindow } from "@/features/fixtures/useFixturesWindow";
import { TOUR_STEPS } from "./tourSteps";
import { useTutorial } from "./TutorialContext";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_W = 360;
const CARD_GAP = 12;
const PAD = 8;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function findTourEl(targetId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour-id="${targetId}"]`);
}

function getRectByTourId(targetId: string): Rect | null {
  const el = findTourEl(targetId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function scrollTargetIntoView(
  targetId: string,
  reduced: boolean,
  block: ScrollLogicalPosition = "center",
): void {
  const el = findTourEl(targetId);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const fullyVisible = r.top >= 60 && r.bottom <= vh - 60;
  if (fullyVisible) return;
  try {
    el.scrollIntoView({
      block,
      inline: "nearest",
      behavior: reduced ? "auto" : "smooth",
    });
  } catch {
    el.scrollIntoView();
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function TutorialTour() {
  const { isOpen, stepIndex, stopTour, nextStep, prevStep } = useTutorial();
  const navigate = useNavigate();
  const fixtures = useFixturesWindow();
  const [rect, setRect] = useState<Rect | null>(null);
  const [missingTarget, setMissingTarget] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const isFirst = stepIndex === 0;
  const firstMatchId: string | null = fixtures.data?.[0]?.catalogId
    ? String(fixtures.data[0].catalogId)
    : null;

  useEffect(() => {
    if (!isOpen) {
      if (wasOpenRef.current) {
        setShowToast(true);
        const t = window.setTimeout(() => setShowToast(false), 3000);
        wasOpenRef.current = false;
        return () => window.clearTimeout(t);
      }
      return;
    }
    wasOpenRef.current = true;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !step) return;
    setMissingTarget(false);
    setRect(null);

    const path = step.pathBuilder({ firstMatchId });
    navigate(path);

    let cancelled = false;
    let attempts = 0;
    const reduced = prefersReducedMotion();
    let scrolled = false;
    const tryMeasure = () => {
      if (cancelled) return;
      const el = findTourEl(step.targetId);
      if (el) {
        if (!scrolled) {
          scrollTargetIntoView(step.targetId, reduced, step.scrollBlock);
          scrolled = true;
          window.setTimeout(tryMeasure, reduced ? 50 : 320);
          return;
        }
        const r = getRectByTourId(step.targetId);
        if (r) {
          setRect(r);
          return;
        }
      }
      attempts += 1;
      if (attempts > 12) {
        setMissingTarget(true);
        window.setTimeout(() => {
          if (!cancelled) nextStep();
        }, 800);
        return;
      }
      window.requestAnimationFrame(() => window.setTimeout(tryMeasure, 60));
    };
    window.requestAnimationFrame(() => window.setTimeout(tryMeasure, 80));

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, firstMatchId, navigate, nextStep]);

  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => {
      if (!step) return;
      const r = getRectByTourId(step.targetId);
      if (r) setRect(r);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [isOpen, step]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        stopTour();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevStep();
      }
    },
    [isOpen, stopTour, nextStep, prevStep],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, handleKey]);

  useEffect(() => {
    if (!isOpen) return;
    titleRef.current?.focus();
  }, [isOpen, stepIndex]);

  if (!isOpen && !showToast) return null;

  if (showToast && !isOpen) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1100,
          padding: "12px 18px",
          background: "var(--zs-bg)",
          border: "1px solid var(--zs-accent)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--zs-accent)",
          textTransform: "uppercase",
          boxShadow: "0 0 24px rgba(0,0,0,.45)",
        }}
      >
        ✓ Done. Hit HELP anytime.
      </div>
    );
  }

  if (!step) return null;

  const reduced = prefersReducedMotion();
  const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  const hasRect = rect !== null && !missingTarget;
  const spotlightRect = hasRect && rect
    ? { top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12 }
    : null;

  let cardTop = vh / 2 - 120;
  let cardLeft = vw / 2 - CARD_W / 2;
  let placement: "below" | "above" | "center" = "center";

  if (spotlightRect) {
    const cardHeightEst = 180;
    const belowTop = spotlightRect.top + spotlightRect.height + CARD_GAP;
    const aboveTop = spotlightRect.top - cardHeightEst - CARD_GAP;
    if (belowTop + cardHeightEst < vh - PAD) {
      cardTop = belowTop;
      placement = "below";
    } else if (aboveTop > PAD) {
      cardTop = aboveTop;
      placement = "above";
    } else {
      cardTop = clamp(spotlightRect.top, PAD, vh - cardHeightEst - PAD);
      placement = "center";
    }
    const centeredLeft = spotlightRect.left + spotlightRect.width / 2 - CARD_W / 2;
    cardLeft = clamp(centeredLeft, PAD, vw - CARD_W - PAD);
  }

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        pointerEvents: "auto",
        background: hasRect ? "transparent" : "rgba(0,0,0,.55)",
        transition: reduced ? "none" : "background 180ms ease-out",
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="tour-step-title"
    >
      {spotlightRect && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            border: "2px solid var(--zs-accent)",
            background: "transparent",
            boxShadow: "0 0 0 9999px rgba(0,0,0,.55), 0 0 16px rgba(0,0,0,.4)",
            pointerEvents: "none",
            transition: reduced ? "none" : "all 220ms ease-out",
          }}
        />
      )}

      <div
        ref={cardRef}
        style={{
          position: "absolute",
          top: cardTop,
          left: cardLeft,
          width: CARD_W,
          background: "var(--zs-bg)",
          border: "1px solid var(--zs-accent)",
          padding: "14px 16px 12px",
          fontFamily: "var(--font-mono)",
          boxShadow: "0 10px 32px rgba(0,0,0,.6)",
          opacity: hasRect || missingTarget ? 1 : 0,
          transform: reduced ? "none" : hasRect || missingTarget ? "translateY(0)" : "translateY(4px)",
          transition: reduced ? "opacity 120ms linear" : "opacity 180ms ease-out, transform 180ms ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span
            style={{
              fontSize: 9,
              color: "var(--zs-fg-muted)",
              letterSpacing: "0.18em",
            }}
          >
            STEP {stepIndex + 1}/{TOUR_STEPS.length}
          </span>
          <button
            onClick={stopTour}
            aria-label="Skip tour"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 6px",
              background: "transparent",
              border: "1px solid var(--zs-border)",
              color: "var(--zs-fg-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.12em",
              cursor: "pointer",
              textTransform: "uppercase",
            }}
          >
            <X size={10} strokeWidth={2} />
            SKIP
          </button>
        </div>

        <div
          ref={titleRef}
          id="tour-step-title"
          tabIndex={-1}
          style={{
            fontSize: 13,
            color: "var(--zs-accent)",
            letterSpacing: "0.14em",
            fontWeight: 700,
            marginBottom: 8,
            outline: "none",
          }}
        >
          {step.title}
        </div>

        <div
          style={{
            fontSize: 12,
            color: "var(--zs-fg-dim)",
            lineHeight: 1.55,
            marginBottom: 14,
          }}
        >
          {missingTarget ? step.fallback ?? "View unavailable — skipping…" : step.body}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", gap: 3 }} aria-hidden>
            {TOUR_STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 14,
                  height: 3,
                  background: i === stepIndex ? "var(--zs-accent)" : "var(--zs-border)",
                  transition: reduced ? "none" : "background 160ms ease-out",
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={prevStep}
              disabled={isFirst}
              aria-label="Previous step"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 32,
                height: 28,
                background: "transparent",
                border: "1px solid var(--zs-border)",
                color: isFirst ? "var(--zs-fg-faint)" : "var(--zs-fg-dim)",
                cursor: isFirst ? "default" : "pointer",
                opacity: isFirst ? 0.5 : 1,
              }}
            >
              <ChevronLeft size={14} strokeWidth={2} />
            </button>
            <button
              onClick={nextStep}
              aria-label={isLast ? "Finish tour" : "Next step"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                minWidth: 32,
                height: 28,
                padding: isLast ? "0 12px" : 0,
                background: "var(--zs-accent-fill)",
                border: "1px solid var(--zs-accent)",
                color: "var(--zs-accent)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.14em",
                fontWeight: 700,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {isLast ? (
                <>
                  <Check size={12} strokeWidth={2.5} /> DONE
                </>
              ) : (
                <ChevronRight size={14} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {placement !== "center" && spotlightRect && (
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: clamp(
                spotlightRect.left + spotlightRect.width / 2 - cardLeft - 6,
                12,
                CARD_W - 24,
              ),
              [placement === "below" ? "top" : "bottom"]: -7,
              width: 12,
              height: 12,
              transform: "rotate(45deg)",
              background: "var(--zs-bg)",
              border: "1px solid var(--zs-accent)",
              borderRight: placement === "below" ? "none" : "1px solid var(--zs-accent)",
              borderBottom: placement === "below" ? "none" : "1px solid var(--zs-accent)",
              borderTop: placement === "above" ? "none" : "1px solid var(--zs-accent)",
              borderLeft: placement === "above" ? "none" : "1px solid var(--zs-accent)",
            }}
          />
        )}
      </div>
    </div>
  );
}
