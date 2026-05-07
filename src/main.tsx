import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { queryClient } from "./services/cache/queryClient";
import {
  WINDOW_FIXTURES_TTL_MS,
  fetchFdorgWindowFixtures,
  fetchOddsApiIoWindowFixtures,
  fetchSofaRemainingWindowFixtures,
  windowFdorgQueryKey,
  windowOddsIoQueryKey,
  windowSofaRemainingQueryKey,
} from "./services/catalog/windowFixtures";
import { bootstrapQuotaTrackers } from "./services/http/quotaBootstrap";
import "./index.css";

void bootstrapQuotaTrackers();

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
  queryClient.prefetchQuery({
    queryKey: windowSofaRemainingQueryKey,
    queryFn: fetchSofaRemainingWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
  }),
]).catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
