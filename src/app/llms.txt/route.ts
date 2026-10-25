import { headers } from "next/headers";
import { MARKETS, SYMBOLS } from "@/lib/symbols";

// llms.txt: a plain-text map of the site for LLMs and agent crawlers (https://llmstxt.org).
export async function GET() {
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const symbols = MARKETS.map((m) => `- ${m.label}: ${SYMBOLS.filter((s) => s.market === m.id).map((s) => s.id).join(", ")}`).join("\n");
  const body = `# MarketPulse

> Live market data (crypto, forex, US stocks, India NSE) for humans and AI agents. Read-only, no auth by default. Informational only, not investment advice.

## MCP server
- Endpoint (Streamable HTTP, stateless): ${base}/api/mcp
- Tools: list_symbols, get_quote, get_quotes, get_candles, market_overview

## REST API
- [Symbols](${base}/api/v1/symbols): GET, optional ?market=crypto|forex|us|nse
- [Quotes](${base}/api/v1/quotes?symbols=BTC,AAPL,NIFTY): GET ?symbols=ID,ID or ?market=
- [Candles](${base}/api/v1/candles?symbol=BTC&range=1d): GET ?symbol=&range=1d|5d|1mo|6mo|1y
- [Overview](${base}/api/v1/overview): GET, all markets plus top gainers/losers

## Symbols
${symbols}

## Docs
- [Full docs](${base}/docs)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
