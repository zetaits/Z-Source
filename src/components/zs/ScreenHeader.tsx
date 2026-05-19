import type { ReactNode } from "react";

interface Props {
  bracket: string;
  title: string;
  sub?: string;
  right?: ReactNode;
}

export function ScreenHeader({ bracket, title, sub, right }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        marginBottom: 22,
      }}
    >
      <div className="zs-screen-h" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <div className="bracket">[ {bracket} ]</div>
        <div className="title">{title}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>{right}</div>}
    </div>
  );
}
