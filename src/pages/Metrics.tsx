import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CalibrationChart } from "@/features/metrics/components/CalibrationChart";
import { KpiCards } from "@/features/metrics/components/KpiCards";
import { SummaryTable } from "@/features/metrics/components/SummaryTable";
import {
  useMetricsCalibration,
  useMetricsList,
  useMetricsSummary,
} from "@/features/metrics/hooks/useMetrics";
import { isPersistentStorage } from "@/storage";

export function Metrics() {
  const persistent = isPersistentStorage();
  const summary = useMetricsSummary();
  const calibration = useMetricsCalibration(10);
  const list = useMetricsList(1000);

  if (!persistent) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Hit rate, ROI and model calibration across logged plays.
          </p>
        </header>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Desktop required</AlertTitle>
          <AlertDescription>
            Metrics live in local SQLite. Run via{" "}
            <code className="font-mono text-xs">npm run tauri:dev</code> to view them.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const loading = summary.isLoading || calibration.isLoading || list.isLoading;

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Metrics</h1>
        <p className="text-sm text-muted-foreground">
          Hit rate, ROI and calibration across logged plays.
        </p>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <KpiCards outcomes={list.data ?? []} />

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              By verdict × market
            </h2>
            <SummaryTable rows={summary.data ?? []} />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold tracking-tight">
              Calibration (predicted vs realised)
            </h2>
            <p className="text-xs text-muted-foreground">
              Each dot is a probability bin. Dot size reflects sample count. The
              dashed diagonal is a perfectly calibrated model.
            </p>
            <CalibrationChart bins={calibration.data ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
