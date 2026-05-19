import type { ReactNode } from "react";

export type StatTone = "fg" | "pos" | "neg" | "amber";

interface Props {
  caption: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatTone;
  big?: boolean;
  right?: ReactNode;
}

export function Stat({ caption, value, sub, tone = "fg", big = false, right }: Props) {
  const toneClass = tone === "pos" ? "pos" : tone === "neg" ? "neg" : tone === "amber" ? "amber" : "";
  return (
    <div className="zs-block" style={{ padding: "14px 16px 16px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div className="zs-caption">{caption}</div>
        {right}
      </div>
      <div className={`zs-bignum ${toneClass} ${big ? "lg" : ""}`}>{value}</div>
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
