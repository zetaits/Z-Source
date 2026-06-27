// Single app-wide autopilot instance. The loop must run once regardless of
// which page is mounted, so the provider sits in AppShell and the Bankroll
// panel (and any status indicator) consume the same instance via context.

import { createContext, useContext, type ReactNode } from "react";
import { useAutopilot, type UseAutopilot } from "./useAutopilot";

const AutopilotContext = createContext<UseAutopilot | null>(null);

export const AutopilotProvider = ({ children }: { children: ReactNode }) => {
  const value = useAutopilot();
  return <AutopilotContext.Provider value={value}>{children}</AutopilotContext.Provider>;
};

export const useAutopilotContext = (): UseAutopilot => {
  const ctx = useContext(AutopilotContext);
  if (!ctx) throw new Error("useAutopilotContext must be used within AutopilotProvider");
  return ctx;
};
