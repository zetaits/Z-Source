export function formatRelativeShort(iso: string): string {
  const diffMin = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (diffMin < 0) return "kickoff passed";
  if (diffMin < 60) return `${diffMin}m`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  if (h < 24) return `${h}h ${m.toString().padStart(2, "0")}m`;
  const days = Math.round(h / 24);
  return `${days}d`;
}
