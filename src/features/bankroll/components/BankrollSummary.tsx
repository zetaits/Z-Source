import type { BankrollSettings } from "@/domain/bankroll";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney, formatSignedMoney, toMajor } from "@/lib/money";

interface Props {
  balanceMinor: number;
  exposureMinor: number;
  openBetCount: number;
  settings: BankrollSettings;
}

export function BankrollSummary({ balanceMinor, exposureMinor, openBetCount, settings }: Props) {
  const pnlMinor = balanceMinor - settings.startingBankrollMinor;
  const availableMinor = balanceMinor - exposureMinor;
  const units =
    settings.unitValueMinor > 0
      ? toMajor(availableMinor) / toMajor(settings.unitValueMinor)
      : 0;
  const roi =
    settings.startingBankrollMinor > 0 ? pnlMinor / settings.startingBankrollMinor : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat
        label="Balance"
        value={formatMoney(balanceMinor, settings.currency)}
        sub={
          exposureMinor > 0
            ? `${formatMoney(exposureMinor, settings.currency)} locked · ${openBetCount} open ${openBetCount === 1 ? "bet" : "bets"}`
            : "No open exposure"
        }
        subTone={exposureMinor > 0 ? "warn" : "muted"}
      />
      <Stat
        label="Available"
        value={formatMoney(availableMinor, settings.currency)}
        sub={`${units.toFixed(2)} units left`}
      />
      <Stat
        label="P/L vs start"
        value={formatSignedMoney(pnlMinor, settings.currency)}
        tone={pnlMinor >= 0 ? "pos" : "neg"}
        sub={`Start ${formatMoney(settings.startingBankrollMinor, settings.currency)}`}
      />
      <Stat
        label="ROI"
        value={`${(roi * 100).toFixed(2)}%`}
        tone={roi >= 0 ? "pos" : "neg"}
        sub="On starting bankroll"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
  subTone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "pos" | "neg";
  subTone?: "muted" | "warn";
}) {
  const valueTone =
    tone === "pos"
      ? "text-[hsl(var(--success))]"
      : tone === "neg"
        ? "text-destructive"
        : "text-foreground";
  const subClass =
    subTone === "warn"
      ? "text-[hsl(var(--warning))]"
      : "text-muted-foreground";
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 p-4">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={`font-mono text-xl font-semibold tabular-nums ${valueTone}`}>
          {value}
        </span>
        {sub && <span className={`text-xs tabular-nums ${subClass}`}>{sub}</span>}
      </CardContent>
    </Card>
  );
}
