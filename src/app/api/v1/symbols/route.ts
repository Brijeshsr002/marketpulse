import { json, preflight } from "@/lib/http";
import { isMarket, MARKETS, SYMBOLS } from "@/lib/symbols";

export async function GET(request: Request) {
  const market = new URL(request.url).searchParams.get("market");
  if (market && !isMarket(market)) return json({ error: `market must be one of ${MARKETS.map((m) => m.id).join(", ")}` }, 400);
  const symbols = SYMBOLS.filter((s) => !market || s.market === market).map(({ id, name, market }) => ({ id, name, market }));
  return json({ markets: MARKETS, symbols });
}

export const OPTIONS = preflight;
