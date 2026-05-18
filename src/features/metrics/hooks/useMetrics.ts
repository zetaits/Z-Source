import { useQuery } from "@tanstack/react-query";
import { pickOutcomesRepo } from "@/storage/repos/pickOutcomesRepo";
import { isPersistentStorage } from "@/storage";

const QK_SUMMARY = ["metrics", "summary"] as const;
const QK_CALIBRATION = ["metrics", "calibration"] as const;
const QK_LIST = ["metrics", "list"] as const;

export const useMetricsSummary = () =>
  useQuery({
    queryKey: QK_SUMMARY,
    queryFn: () => pickOutcomesRepo.summaryByVerdictMarket(),
    enabled: isPersistentStorage(),
  });

export const useMetricsCalibration = (bins = 10) =>
  useQuery({
    queryKey: [...QK_CALIBRATION, bins] as const,
    queryFn: () => pickOutcomesRepo.calibrationData(bins),
    enabled: isPersistentStorage(),
  });

export const useMetricsList = (limit = 1000) =>
  useQuery({
    queryKey: [...QK_LIST, limit] as const,
    queryFn: () => pickOutcomesRepo.list({ limit }),
    enabled: isPersistentStorage(),
  });
