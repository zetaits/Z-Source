export const toMinor = (major: number): number => Math.round(major * 100);
export const toMajor = (minor: number): number => minor / 100;

const SUFFIX_CURRENCIES = new Set(["EUR"]);

const CURRENCY_SYMBOL: Record<string, string> = {
  EUR: "€",
};

const LOCALE_BY_CURRENCY: Record<string, string> = {
  EUR: "de-DE",
};

export const formatMoney = (minor: number, currency = "USD", locale?: string): string => {
  const fmtLocale = locale ?? LOCALE_BY_CURRENCY[currency] ?? "en-US";
  try {
    if (SUFFIX_CURRENCIES.has(currency)) {
      const num = new Intl.NumberFormat(fmtLocale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(toMajor(minor));
      const symbol = CURRENCY_SYMBOL[currency] ?? currency;
      return `${num} ${symbol}`;
    }
    return new Intl.NumberFormat(fmtLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(toMajor(minor));
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
};

export const formatSignedMoney = (minor: number, currency = "USD", locale?: string): string => {
  const sign = minor > 0 ? "+" : minor < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(minor), currency, locale)}`;
};
