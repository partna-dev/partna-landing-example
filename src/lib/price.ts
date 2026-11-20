export const BP_SCALE = 10_000;

export function discountMinor(priceMinor: number, discountBp: number): number {
  if (priceMinor <= 0 || discountBp <= 0) {
    return 0;
  }
  return Math.floor((priceMinor * discountBp) / BP_SCALE);
}

export function clientPriceMinor(priceMinor: number, discountBp: number): number {
  return priceMinor - discountMinor(priceMinor, discountBp);
}

export function dueMinor(
  priceMinor: number,
  discountBp: number,
  certificateMinor: number,
): number {
  const covered = Math.min(Math.max(certificateMinor, 0), clientPriceMinor(priceMinor, discountBp));
  return clientPriceMinor(priceMinor, discountBp) - covered;
}

export function percent(discountBp: number): string {
  const value = discountBp / 100;
  return Number.isInteger(value) ? `${value}%` : `${value.toFixed(2)}%`;
}

export function money(minor: number, currency: string): string {
  const sign = currency === "RUB" ? "₽" : currency;
  const whole = Math.trunc(minor / 100);
  const rest = Math.abs(minor % 100);
  const grouped = whole.toLocaleString("ru-RU");
  if (rest === 0) {
    return `${grouped} ${sign}`;
  }
  return `${grouped},${String(rest).padStart(2, "0")} ${sign}`;
}
