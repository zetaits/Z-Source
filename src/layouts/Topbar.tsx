import { Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotaMeter } from "@/components/domain/QuotaMeter";

interface Props {
  onOpenPalette?(): void;
}

const isMac =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad|ipod/i.test(navigator.platform ?? "");

export function Topbar({ onOpenPalette }: Props) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <div className="flex items-center gap-3">
        <div
          className="size-2 rounded-full bg-success animate-pulse"
          aria-hidden
        />
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          ready
        </span>
      </div>
      <div className="flex items-center gap-4">
        {onOpenPalette ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-2 px-2.5 font-mono text-[11px] text-muted-foreground"
            onClick={onOpenPalette}
            aria-label="Open command palette"
          >
            <Command className="size-3.5" aria-hidden />
            <span className="tracking-wider">{isMac ? "⌘" : "Ctrl"} K</span>
          </Button>
        ) : null}
        <QuotaMeter />
      </div>
    </header>
  );
}
