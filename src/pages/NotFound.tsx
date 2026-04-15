import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <Link to="/" className="text-sm text-primary hover:underline">
        Back to Command Center
      </Link>
    </div>
  );
}
