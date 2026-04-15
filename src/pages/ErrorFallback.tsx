import { AlertTriangle } from "lucide-react";
import { Link, useRouteError } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface RouteErrorLike {
  status?: number;
  statusText?: string;
  message?: string;
  stack?: string;
}

const isErrorLike = (value: unknown): value is RouteErrorLike =>
  typeof value === "object" && value !== null;

export function ErrorFallback() {
  const error = useRouteError();
  const info = isErrorLike(error) ? error : undefined;
  const title = info?.statusText
    ? `${info.status ?? ""} ${info.statusText}`.trim()
    : "Something went wrong";
  const detail =
    info?.message ??
    (typeof error === "string" ? error : "An unexpected error occurred.");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex items-center gap-2 text-warning">
        <AlertTriangle className="h-5 w-5" />
        <p className="font-mono text-xs uppercase tracking-wider">Error</p>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-lg text-center text-sm text-muted-foreground">
        {detail}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button asChild>
          <Link to="/">Back to Command Center</Link>
        </Button>
      </div>
      {import.meta.env.DEV && info?.stack ? (
        <pre className="mt-4 max-h-64 w-full max-w-3xl overflow-auto rounded-md border border-border bg-muted/30 p-3 text-[11px] font-mono text-muted-foreground">
          {info.stack}
        </pre>
      ) : null}
    </div>
  );
}
