import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { queryClient } from "./services/cache/queryClient";
import {
  WINDOW_FIXTURES_TTL_MS,
  fetchWindowFixtures,
  windowFixturesQueryKey,
} from "./services/catalog/windowFixtures";
import { bootstrapQuotaTrackers } from "./services/http/quotaBootstrap";
import "./index.css";

void bootstrapQuotaTrackers();

void queryClient
  .prefetchQuery({
    queryKey: windowFixturesQueryKey,
    queryFn: fetchWindowFixtures,
    staleTime: WINDOW_FIXTURES_TTL_MS,
  })
  .catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
