import { cn } from "@/lib/utils";

interface Props {
  value: number;
  onChange(daysOffset: number): void;
}

const TABS: { offset: number; label: string }[] = [
  { offset: 0, label: "Today" },
  { offset: 1, label: "+1d" },
  { offset: 2, label: "+2d" },
  { offset: 3, label: "+3d" },
];

export function DateTabs({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Scan window offset"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-card/40 p-1"
    >
      {TABS.map((tab) => {
        const active = tab.offset === value;
        return (
          <button
            key={tab.offset}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.offset)}
            className={cn(
              "rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
