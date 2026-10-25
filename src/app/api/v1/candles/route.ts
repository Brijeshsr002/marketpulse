import { json, preflight } from "@/lib/http";
import { getCandles, getCandlesByInterval, INTERVALS, isInterval, isRange, RANGES } from "@/lib/market";

// GET /api/v1/candles?symbol=BTC&interval=1m   (latest 240 bars of that size)
// GET /api/v1/candles?symbol=AAPL&range=1d     (a whole time window)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const interval = params.get("interval");
  const range = params.get("range") ?? "1d";
  if (!symbol) return json({ error: "symbol is required" }, 400);
  if (interval && !isInterval(interval)) return json({ error: `interval must be one of ${INTERVALS.join(", ")}` }, 400);
  if (!interval && !isRange(range)) return json({ error: `range must be one of ${RANGES.join(", ")}` }, 400);
  try {
    const candles = isInterval(interval) ? await getCandlesByInterval(symbol, interval) : await getCandles(symbol, range as (typeof RANGES)[number]);
    return json({ symbol: symbol.toUpperCase(), ...(interval ? { interval } : { range }), candles });
  } catch (e) {
    return json({ error: (e as Error).message }, /Unknown symbol/.test((e as Error).message) ? 404 : 502);
  }
}

export const OPTIONS = preflight;
