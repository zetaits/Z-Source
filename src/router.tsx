import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { ErrorFallback } from "@/pages/ErrorFallback";
import { NotFound } from "@/pages/NotFound";

const CommandCenter = lazy(() =>
  import("@/pages/CommandCenter").then((m) => ({ default: m.CommandCenter })),
);
const Scanner = lazy(() =>
  import("@/pages/Scanner").then((m) => ({ default: m.Scanner })),
);
const MatchDetail = lazy(() =>
  import("@/pages/MatchDetail").then((m) => ({ default: m.MatchDetail })),
);
const Bankroll = lazy(() =>
  import("@/pages/Bankroll").then((m) => ({ default: m.Bankroll })),
);
const Metrics = lazy(() =>
  import("@/pages/Metrics").then((m) => ({ default: m.Metrics })),
);
const Strategy = lazy(() =>
  import("@/pages/Strategy").then((m) => ({ default: m.Strategy })),
);
const Settings = lazy(() =>
  import("@/pages/Settings").then((m) => ({ default: m.Settings })),
);
const EnginePlayground = lazy(() =>
  import("@/pages/EnginePlayground").then((m) => ({ default: m.EnginePlayground })),
);

const RouteFallback = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      color: "var(--zs-fg-dim)",
      fontFamily: "var(--zs-font-mono, monospace)",
      fontSize: 12,
      opacity: 0.5,
    }}
  >
    loading…
  </div>
);

const lazyRoute = (Page: React.ComponentType) => (
  <Suspense fallback={<RouteFallback />}>
    <Page />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: lazyRoute(CommandCenter), errorElement: <ErrorFallback /> },
      { path: "scanner", element: lazyRoute(Scanner), errorElement: <ErrorFallback /> },
      { path: "match/:id", element: lazyRoute(MatchDetail), errorElement: <ErrorFallback /> },
      { path: "bankroll", element: lazyRoute(Bankroll), errorElement: <ErrorFallback /> },
      { path: "metrics", element: lazyRoute(Metrics), errorElement: <ErrorFallback /> },
      { path: "strategy", element: lazyRoute(Strategy), errorElement: <ErrorFallback /> },
      { path: "settings", element: lazyRoute(Settings), errorElement: <ErrorFallback /> },
      {
        path: "__engine-playground",
        element: lazyRoute(EnginePlayground),
        errorElement: <ErrorFallback />,
      },
      { path: "404", element: <NotFound /> },
      { path: "*", element: <Navigate to="/404" replace /> },
    ],
  },
]);
