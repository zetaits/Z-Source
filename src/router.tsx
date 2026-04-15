import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/layouts/AppShell";
import { CommandCenter } from "@/pages/CommandCenter";
import { Scanner } from "@/pages/Scanner";
import { MatchDetail } from "@/pages/MatchDetail";
import { Bankroll } from "@/pages/Bankroll";
import { Strategy } from "@/pages/Strategy";
import { Settings } from "@/pages/Settings";
import { EnginePlayground } from "@/pages/EnginePlayground";
import { ErrorFallback } from "@/pages/ErrorFallback";
import { NotFound } from "@/pages/NotFound";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: <CommandCenter />, errorElement: <ErrorFallback /> },
      { path: "scanner", element: <Scanner />, errorElement: <ErrorFallback /> },
      { path: "match/:id", element: <MatchDetail />, errorElement: <ErrorFallback /> },
      { path: "bankroll", element: <Bankroll />, errorElement: <ErrorFallback /> },
      { path: "strategy", element: <Strategy />, errorElement: <ErrorFallback /> },
      { path: "settings", element: <Settings />, errorElement: <ErrorFallback /> },
      {
        path: "__engine-playground",
        element: <EnginePlayground />,
        errorElement: <ErrorFallback />,
      },
      { path: "404", element: <NotFound /> },
      { path: "*", element: <Navigate to="/404" replace /> },
    ],
  },
]);
