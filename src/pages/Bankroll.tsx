import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Minus, Plus, Settings as SettingsIcon, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isPersistentStorage } from "@/storage";
import {
  useBankrollSettings,
  useCurrentBalance,
  useLedger,
  useResetBankroll,
} from "@/features/bankroll/hooks/useBankroll";
import { useBets, useOpenExposure } from "@/features/bankroll/hooks/useBets";
import { useEquityCurve } from "@/features/bankroll/hooks/useEquityCurve";
import { BankrollSummary } from "@/features/bankroll/components/BankrollSummary";
import { EquityCurveChart } from "@/features/bankroll/components/EquityCurveChart";
import { LedgerTable } from "@/features/bankroll/components/LedgerTable";
import { BetsTable } from "@/features/bankroll/components/BetsTable";
import { AdjustBankrollDialog } from "@/features/bankroll/components/AdjustBankrollDialog";
import { BankrollSettingsDialog } from "@/features/bankroll/components/BankrollSettingsDialog";
import { BetEntryDialog } from "@/features/bankroll/components/BetEntryDialog";

export function Bankroll() {
  const persistent = isPersistentStorage();
  const settings = useBankrollSettings();
  const balance = useCurrentBalance();
  const ledger = useLedger();
  const bets = useBets();
  const exposure = useOpenExposure();
  const reset = useResetBankroll();
  const curve = useEquityCurve(ledger.data);

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [betOpen, setBetOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("log") === "1" && persistent) {
      setBetOpen(true);
      searchParams.delete("log");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, persistent]);

  if (!persistent) {
    return (
      <div className="flex h-full flex-col gap-6 p-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Bankroll</h1>
        </header>
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Desktop required</AlertTitle>
          <AlertDescription>
            The bet log + ledger live in a local SQLite database. Run via{" "}
            <code className="font-mono text-xs">npm run tauri:dev</code> to use this view.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading = settings.isLoading || balance.isLoading || ledger.isLoading;
  const cfg = settings.data;
  const bal = balance.data;

  return (
    <div className="flex h-full flex-col gap-6 p-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Bankroll</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Ledger-driven balance, unit sizing and bet log. Each bet writes two entries (stake + result).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setDepositOpen(true)}>
              <Plus className="mr-1.5 size-3.5" /> Deposit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setWithdrawOpen(true)}>
              <Minus className="mr-1.5 size-3.5" /> Withdraw
            </Button>
            <Button size="sm" onClick={() => setBetOpen(true)}>
              <Wallet className="mr-1.5 size-3.5" /> Log bet
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {isLoading || !cfg || bal === undefined ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <BankrollSummary
            balanceMinor={bal}
            exposureMinor={exposure.data ?? 0}
            openBetCount={(bets.data ?? []).filter((b) => b.status === "OPEN").length}
            settings={cfg}
          />
          <EquityCurveChart points={curve} currency={cfg.currency} />
          <Tabs defaultValue="bets">
            <TabsList>
              <TabsTrigger value="bets">Bets ({bets.data?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="ledger">Ledger ({ledger.data?.length ?? 0})</TabsTrigger>
            </TabsList>
            <TabsContent value="bets" className="mt-4">
              <BetsTable bets={bets.data ?? []} bankroll={cfg} />
            </TabsContent>
            <TabsContent value="ledger" className="mt-4">
              <LedgerTable entries={ledger.data ?? []} currency={cfg.currency} />
            </TabsContent>
          </Tabs>

          <AdjustBankrollDialog mode="DEPOSIT" open={depositOpen} onOpenChange={setDepositOpen} />
          <AdjustBankrollDialog mode="WITHDRAWAL" open={withdrawOpen} onOpenChange={setWithdrawOpen} />
          <BankrollSettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            current={cfg}
            onReset={(starting) => reset.mutate(starting)}
          />
          <BetEntryDialog open={betOpen} onOpenChange={setBetOpen} bankroll={cfg} />
        </>
      )}
    </div>
  );
}
