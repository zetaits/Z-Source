export const toMinor = (major: number): number => Math.round(major * 100);
export const toMajor = (minor: number): number => minor / 100;

export const formatMoney = (minor: number, currency = "USD", locale = "en-US"): string => {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(toMajor(minor));
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
};

export const formatSignedMoney = (minor: number, currency = "USD", locale = "en-US"): string => {
  const sign = minor > 0 ? "+" : minor < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(minor), currency, locale)}`;
};
