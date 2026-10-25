# MarketPulse

Live market dashboard (crypto, forex, US stocks, India NSE) with an MCP server and REST API so AI agents (Claude, n8n, Sendiee and others) can read live prices.

- **Dashboard**: `/`: ticker tape, market tabs, live quotes with sparklines, interactive chart, top movers.
- **AI Docs**: `/docs`: how to connect Claude, Claude Code, Cursor, n8n and Sendiee.
- **MCP server**: `POST /api/mcp`, stateless Streamable HTTP. Tools: `list_symbols`, `get_quote`, `get_quotes`, `get_candles`, `market_overview`.
- **REST API**: `/api/v1/symbols`, `/api/v1/quotes`, `/api/v1/candles`, `/api/v1/overview`.
- **llms.txt**: `/llms.txt`.

## Data sources (free, no keys)

| Market | Source | Latency |
| --- | --- | --- |
| Crypto | Binance public API + WebSocket (`data-api.binance.vision`, `stream.binance.com`) | real-time |
| Forex, US, NSE | Yahoo Finance chart API (unofficial) | up to ~15 min delayed |

Add or remove symbols in `src/lib/symbols.ts`. For production-grade stock/forex data, swap `yahooQuote`/`yahooChart` in `src/lib/market.ts` for a licensed feed (Finnhub, Polygon, Twelve Data, Zerodha Kite for NSE).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint && npm run typecheck && npm run build
```

## Deploy

Import the GitHub repo in Vercel (no env vars required). Optionally set `MCP_API_KEY` to protect `/api/mcp`.

Data is informational only, not investment advice.
