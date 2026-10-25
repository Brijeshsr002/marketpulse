export type Bar = { time: number; open: number; high: number; low: number; close: number; volume: number };

export function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  values.forEach((v, i) => out.push(i === 0 ? v : v * k + out[i - 1] * (1 - k)));
  return out;
}

/** Wilder's RSI of the last value. */
export function rsi(values: number[], period = 14): number {
  if (values.length <= period) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
  }
  return loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
}

export type Signal = { side: "UP" | "DOWN"; reason: string; rsi: number; emaFast: number; emaSlow: number };

/**
 * Experimental rule for the next candle, evaluated on closed bars only:
 * follow the EMA(9)/EMA(21) trend, but fade it when RSI(14) is stretched (>70 or <30).
 * It is a hypothesis to be measured by the tracker, not a prediction.
 */
export function nextCandleSignal(closedBars: Bar[]): Signal | null {
  if (closedBars.length < 30) return null;
  const closes = closedBars.map((b) => b.close);
  const fast = ema(closes, 9).at(-1)!;
  const slow = ema(closes, 21).at(-1)!;
  const r = rsi(closes);
  if (r > 70) return { side: "DOWN", reason: `RSI ${r.toFixed(0)} overbought → fade`, rsi: r, emaFast: fast, emaSlow: slow };
  if (r < 30) return { side: "UP", reason: `RSI ${r.toFixed(0)} oversold → fade`, rsi: r, emaFast: fast, emaSlow: slow };
  const side = fast >= slow ? "UP" : "DOWN";
  return { side, reason: `EMA9 ${side === "UP" ? "above" : "below"} EMA21 → follow trend`, rsi: r, emaFast: fast, emaSlow: slow };
}
