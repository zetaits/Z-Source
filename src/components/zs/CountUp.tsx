import { useEffect, useState, type CSSProperties } from "react";

interface Props {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  start?: number;
  className?: string;
  style?: CSSProperties;
}

export function CountUp({
  value,
  format = (n) => n.toFixed(0),
  duration = 520,
  start = 0,
  className,
  style,
}: Props) {
  const [v, setV] = useState(start);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setV(value);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(start + (value - start) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, start]);

  return (
    <span className={className} style={style}>
      {format(v)}
    </span>
  );
}
