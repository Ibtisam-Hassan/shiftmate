/** The rate in force on a date: latest `effectiveFrom` on or before it. Rates sorted any way. */
export function rateOn(
  rates: { hourlyRateCents: number; effectiveFrom: string }[],
  date: string,
): number | null {
  let best: { hourlyRateCents: number; effectiveFrom: string } | null = null;
  for (const r of rates) {
    if (r.effectiveFrom <= date && (!best || r.effectiveFrom > best.effectiveFrom)) best = r;
  }
  return best?.hourlyRateCents ?? null;
}

export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    maximumFractionDigits: opts.compact ? 0 : 2, minimumFractionDigits: opts.compact ? 0 : 2,
  }).format(cents / 100);
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}
