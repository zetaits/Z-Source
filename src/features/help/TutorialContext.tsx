import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface TutorialState {
  isOpen: boolean;
  stepIndex: number;
  startTour(): void;
  stopTour(): void;
  goToStep(n: number): void;
  nextStep(): void;
  prevStep(): void;
}

const TutorialCtx = createContext<TutorialState | null>(null);

export function TutorialProvider({ children, totalSteps }: { children: ReactNode; totalSteps: number }) {
  const [isOpen, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setOpen(true);
  }, []);

  const stopTour = useCallback(() => {
    setOpen(false);
  }, []);

  const goToStep = useCallback(
    (n: number) => {
      const clamped = Math.max(0, Math.min(totalSteps - 1, n));
      setStepIndex(clamped);
    },
    [totalSteps],
  );

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      if (i >= totalSteps - 1) {
        setOpen(false);
        return i;
      }
      return i + 1;
    });
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  const value = useMemo<TutorialState>(
    () => ({ isOpen, stepIndex, startTour, stopTour, goToStep, nextStep, prevStep }),
    [isOpen, stepIndex, startTour, stopTour, goToStep, nextStep, prevStep],
  );

  return <TutorialCtx.Provider value={value}>{children}</TutorialCtx.Provider>;
}

export function useTutorial(): TutorialState {
  const ctx = useContext(TutorialCtx);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}
