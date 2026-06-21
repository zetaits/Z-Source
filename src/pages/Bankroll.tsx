import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Block, EquityChart, ScreenHeader, Stat } from "@/components/zs";
import { isPersistentStorage } from "@/storage";
import {
  useBankrollSettings,
  useCurrentBalance,
  useLedger,
  useResetBankroll,
} from "@/features/bankroll/hooks/useBankroll";
import { useBets, useOpenExposure } from "@/features/bankroll/hooks/useBets";
import { useEquityCurve } from "@/features/bankroll/hooks/useEquityCurve";
import { LedgerTable } from "@/features/bankroll/components/LedgerTable";
import { BetsTable } from "@/features/bankroll/components/BetsTable";
import { ClvSummaryCard } from "@/features/bankroll/components/ClvSummaryCard";
import { AdjustBankrollDialog } from "@/features/bankroll/components/AdjustBankrollDialog";
import { BankrollSettingsDialog } from "@/features/bankroll/components/BankrollSettingsDialog";
import { BetEntryDialog } from "@/features/bankroll/components/BetEntryDialog";
import { formatMoney } from "@/lib/money";

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
      <div style={{ padding: "28px 32px 48px" }}>
        <ScreenHeader bracket="BANKROLL · LEDGER" title="LEDGER" sub="Desktop required" />
        <Alert>
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
  const currency = cfg?.currency ?? "USD";
  const startMinor = cfg?.startingBankrollMinor ?? 0;
  const settledCount = (bets.data ?? []).filter((b) => b.status !== "OPEN").length;
  const pnl = bal !== undefined ? bal - startMinor : 0;
  const roi = startMinor > 0 ? pnl / startMinor : 0;
  const unitMinor = cfg?.unitValueMinor ?? 0;
  const unitsLeft = bal !== undefined && unitMinor > 0 ? bal / unitMinor : 0;

  return (
    <div style={{ padding: "28px 32px 48px" }}>
      <ScreenHeader
        bracket={`BANKROLL · LEDGER · ${settledCount} SETTLED`}
        title="LEDGER"
        sub="Ledger-driven balance · unit sizing · paired stake + result entries"
        right={
          <>
            <button className="zs-btn ghost" onClick={() => setDepositOpen(true)}>＋ DEPOSIT</button>
            <button className="zs-btn ghost" onClick={() => setWithdrawOpen(true)}>− WITHDRAW</button>
            <button className="zs-btn primary" onClick={() => setBetOpen(true)}>＋ LOG BET</button>
            <button className="zs-btn ghost" onClick={() => setSettingsOpen(true)} aria-label="Bankroll settings">⚙</button>
          </>
        }
      />

      {isLoading || !cfg || bal === undefined ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 22 }}>
            <Stat
              caption={`BALANCE · ${currency}`}
              value={formatMoney(bal, currency)}
              sub={(exposure.data ?? 0) > 0 ? `${formatMoney(exposure.data ?? 0, currency)} AT RISK` : "NO OPEN EXPOSURE"}
              big
            />
            <Stat
              caption={`AVAILABLE · ${currency}`}
              value={formatMoney(Math.max(0, bal - (exposure.data ?? 0)), currency)}
              sub={unitMinor > 0 ? `${unitsLeft.toFixed(2)} UNITS LEFT` : "—"}
              big
            />
            <Stat
              caption="P/L · START"
              value={`${pnl >= 0 ? "+" : "−"}${formatMoney(Math.abs(pnl), currency)}`}
              tone={pnl >= 0 ? "pos" : "neg"}
              sub={`START ${formatMoney(startMinor, currency)}`}
              big
            />
            <Stat
              caption="ROI"
              value={startMinor > 0 ? `${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(2)}%` : "—"}
              tone="amber"
              sub="ON STARTING BANKROLL"
              big
            />
          </div>

          <Block head="EQUITY CURVE · 30D" pad={false} style={{ marginBottom: 22 }}>
            <div data-tour-id="bankroll-equity" style={{ padding: "16px 22px 12px" }}>
              <EquityChart
                points={curve.map((p) => p.balanceMinor)}
                height={240}
                formatLabel={(v) => formatMoney(v, currency)}
              />
            </div>
            {curve.length > 1 && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0 24px 14px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  color: "var(--zs-fg-muted)",
                  letterSpacing: "0.10em",
                }}
              >
                <span>{new Date(curve[0].t).toLocaleDateString()}</span>
                <span>{new Date(curve[curve.length - 1].t).toLocaleDateString()}</span>
              </div>
            )}
          </Block>

          <div style={{ marginBottom: 22 }}>
            <ClvSummaryCard bets={bets.data ?? []} />
          </div>

          <Tabs defaultValue="bets">
            <TabsList>
              <TabsTrigger value="bets">BETS ({bets.data?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="ledger">LEDGER ({ledger.data?.length ?? 0})</TabsTrigger>
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
