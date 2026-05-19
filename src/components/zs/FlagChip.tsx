interface Props {
  cc: string;
}

export function FlagChip({ cc }: Props) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: "0.06em",
        padding: "2px 5px",
        background: "var(--zs-bg)",
        border: "1px solid var(--zs-border)",
        color: "var(--zs-fg-dim)",
        textTransform: "uppercase",
      }}
    >
      {cc}
    </span>
  );
}
