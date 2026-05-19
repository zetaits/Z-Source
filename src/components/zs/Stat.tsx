import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

export type StatTone = "fg" | "pos" | "neg" | "amber";

interface Props {
  caption: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  big?: boolean;
  right?: ReactNode;
}

const BASE_SIZE_LG = 80;
const BASE_SIZE_DEFAULT = 56;
const MIN_SIZE = 18;
const STEP = 1;

function AutoFitText({
  children,
  baseSize,
  className,
}: {
  children: ReactNode;
  baseSize: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const fit = () => {
    const el = ref.current;
    if (!el) return;
    let size = baseSize;
    el.style.fontSize = `${size}px`;
    let guard = 0;
    while (el.scrollWidth > el.clientWidth && size > MIN_SIZE && guard < 200) {
      size -= STEP;
      el.style.fontSize = `${size}px`;
      guard += 1;
    }
  };

  useLayoutEffect(() => {
    fit();
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{ whiteSpace: "nowrap", overflow: "hidden", maxWidth: "100%", width: "100%" }}
    >
      {children}
    </div>
  );
}

export function Stat({ caption, value, sub, tone = "fg", big = false, right }: Props) {
  const toneClass = tone === "pos" ? "pos" : tone === "neg" ? "neg" : tone === "amber" ? "amber" : "";
  const baseSize = big ? BASE_SIZE_LG : BASE_SIZE_DEFAULT;
  return (
    <div
      className="zs-block"
      style={{
        padding: "14px 16px 16px",
        position: "relative",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div className="zs-caption">{caption}</div>
        {right}
      </div>
      <AutoFitText baseSize={baseSize} className={`zs-bignum ${toneClass} ${big ? "lg" : ""}`}>
        {value}
      </AutoFitText>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--zs-fg-muted)",
            marginTop: 8,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}
