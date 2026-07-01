// Registry of sport autopilot drivers. Add a sport = append its driver here;
// useAutopilot iterates whichever are toggled on in config.
import type { AutopilotDriver } from "./types";
import { baseballDriver } from "./baseballDriver";
import { tennisDriver } from "./tennisDriver";

export const AUTOPILOT_DRIVERS: readonly AutopilotDriver[] = [
  baseballDriver,
  tennisDriver,
];

export type { AutopilotDriver, AutopilotDriverCtx, AutopilotEventKind } from "./types";
