import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { queryClient } from "./services/cache/queryClient";
import {
  WINDOW_FIXTURES_TTL_MS,
  fetchFdorgWindowFixtures,
  fetchOddsApiIoWindowFixtures,
  windowFdorgQueryKey,
  windowOddsIoQueryKey,
} from "./services/catalog/windowFixtures";
import { bootstrapQuotaTrackers } from "./services/http/quotaBootstrap";
import { bootstrapDiscoveredLeagues } from "./services/catalog/oddsApiIoLeagues";
import "./index.css";

void bootstrapQuotaTrackers();
// Hydrate the discovered-league registry from the odds provider's catalog.
// Non-blocking: on completion it invalidates the fixtures queries so the
// prefetch below re-runs with any auto-enabled competitions included.
void bootstrapDiscoveredLeagues();

void Promise.all([
  queryClient.prefetchQuery({
    queryKey: windowFdorgQueryKey,
    queryFn: fetchFdorgWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
  }),
  queryClient.prefetchQuery({
    queryKey: windowOddsIoQueryKey,
    queryFn: fetchOddsApiIoWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
  }),
]).catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
