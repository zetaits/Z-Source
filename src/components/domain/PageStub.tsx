import { Construction } from "lucide-react";

interface PageStubProps {
  title: string;
  description: string;
  milestone: string;
}

export function PageStub({ title, description, milestone }: PageStubProps) {
  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {milestone}
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </header>
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-card/40">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Construction className="size-6" aria-hidden />
          <span className="font-mono text-xs uppercase tracking-wider">
            scaffold — pending implementation
          </span>
        </div>
      </div>
    </div>
  );
}
