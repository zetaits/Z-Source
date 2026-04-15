interface Props {
  title: string;
  description: string;
  milestone: string;
}

export function PlaceholderTab({ title, description, milestone }: Props) {
  return (
    <div className="rounded-lg border border-dashed bg-card p-10 text-center">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {milestone}
      </span>
      <h3 className="mt-2 text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
