import { json, preflight } from "@/lib/http";
import { getQuotes } from "@/lib/market";
import { isMarket } from "@/lib/symbols";

// GET /api/v1/quotes?symbols=BTC,AAPL,NIFTY  or  ?market=crypto  (no params = everything)
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const ids = params.get("symbols")?.split(",").map((s) => s.trim()).filter(Boolean);
  const market = params.get("market");
  if (market && !isMarket(market)) return json({ error: "market must be crypto, forex, us or nse" }, 400);
  const result = await getQuotes({ ids, market: market ?? undefined });
  return json({ asOf: new Date().toISOString(), ...result });
}

export const OPTIONS = preflight;
