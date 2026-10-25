import { json, preflight } from "@/lib/http";
import { getCandles, isRange, RANGES } from "@/lib/market";

// GET /api/v1/candles?symbol=AAPL&range=1d
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = params.get("symbol");
  const range = params.get("range") ?? "1d";
  if (!symbol) return json({ error: "symbol is required" }, 400);
  if (!isRange(range)) return json({ error: `range must be one of ${RANGES.join(", ")}` }, 400);
  try {
    return json({ symbol: symbol.toUpperCase(), range, candles: await getCandles(symbol, range) });
  } catch (e) {
    return json({ error: (e as Error).message }, /Unknown symbol/.test((e as Error).message) ? 404 : 502);
  }
}

export const OPTIONS = preflight;
