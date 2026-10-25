export function formatPrice(n: number) {
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 10 ? 2 : abs >= 1 ? 4 : 5;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatChange(n: number) {
  return `${n >= 0 ? "+" : ""}${formatPrice(n)}`;
}

export function formatPercent(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function formatCompact(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 2 });
}
