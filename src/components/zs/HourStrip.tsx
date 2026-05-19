interface Props {
  active: number[];
}

export function HourStrip({ active }: Props) {
  const set = new Set(active);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 2, alignItems: "center" }}>
      {Array.from({ length: 24 }, (_, h) => (
        <span
          key={h}
          style={{
            height: 4,
            background: set.has(h) ? "var(--zs-accent)" : "var(--zs-rule)",
          }}
        />
      ))}
    </div>
  );
}
