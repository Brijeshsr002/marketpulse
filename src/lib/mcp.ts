import "server-only";
import { getCandles, getOverview, getQuotes, isRange, RANGES } from "./market";
import { isMarket, MARKETS, SYMBOLS } from "./symbols";

// Minimal stateless MCP server (Streamable HTTP transport, JSON responses only).
// Every request is self-contained, which suits serverless hosting: no sessions, no SSE.

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "marketpulse", title: "MarketPulse live markets", version: "1.0.0" };

const marketEnum = { type: "string", enum: MARKETS.map((m) => m.id), description: "crypto, forex, us (US stocks) or nse (India)" };
const readOnly = { readOnlyHint: true, openWorldHint: true };

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

const TOOLS: Tool[] = [
  {
    name: "list_symbols",
    title: "List symbols",
    description: "List every tradable symbol MarketPulse covers (id, name, market). Call this first to learn valid symbol ids.",
    inputSchema: { type: "object", properties: { market: marketEnum } },
    run: async ({ market }) => {
      if (market !== undefined && !isMarket(market)) throw new Error("Invalid market");
      return SYMBOLS.filter((s) => !market || s.market === market).map(({ id, name, market }) => ({ id, name, market }));
    },
  },
  {
    name: "get_quote",
    title: "Get live quote",
    description: "Live price, day change, % change, high/low and volume for one symbol, e.g. BTC, EURUSD, AAPL, NIFTY, RELIANCE.",
    inputSchema: {
      type: "object",
      properties: { symbol: { type: "string", description: "Symbol id from list_symbols" } },
      required: ["symbol"],
    },
    run: async ({ symbol }) => {
      const { quotes, errors } = await getQuotes({ ids: [String(symbol)] });
      if (!quotes[0]) throw new Error(errors[0]?.error ?? "No quote");
      return { ...quotes[0], spark: undefined };
    },
  },
  {
    name: "get_quotes",
    title: "Get live quotes",
    description: "Live quotes for several symbols at once, or for a whole market. Pass either `symbols` or `market`.",
    inputSchema: {
      type: "object",
      properties: { symbols: { type: "array", items: { type: "string" } }, market: marketEnum },
    },
    run: async ({ symbols, market }) => {
      if (market !== undefined && !isMarket(market)) throw new Error("Invalid market");
      const ids = Array.isArray(symbols) ? symbols.map(String) : undefined;
      const { quotes, errors } = await getQuotes({ ids, market });
      return { quotes: quotes.map((q) => ({ ...q, spark: undefined })), errors };
    },
  },
  {
    name: "get_candles",
    title: "Get price history",
    description: "OHLCV candles for charting or technical analysis. Ranges: 1d (5-min bars), 5d (30-min), 1mo, 6mo, 1y.",
    inputSchema: {
      type: "object",
      properties: { symbol: { type: "string" }, range: { type: "string", enum: [...RANGES], default: "1d" } },
      required: ["symbol"],
    },
    run: async ({ symbol, range = "1d" }) => {
      if (!isRange(range)) throw new Error(`range must be one of ${RANGES.join(", ")}`);
      const candles = await getCandles(String(symbol), range);
      return { symbol: String(symbol).toUpperCase(), range, count: candles.length, candles };
    },
  },
  {
    name: "market_overview",
    title: "Market overview",
    description: "Snapshot of all four markets with top gainers and losers. Good starting point for 'how are markets today?'.",
    inputSchema: { type: "object", properties: {} },
    run: () => getOverview(),
  },
];

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const ok = (id: JsonRpcRequest["id"], result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: JsonRpcRequest["id"], code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

/** Handles one JSON-RPC message. Returns null for notifications (no response body). */
export async function handleRpc(msg: JsonRpcRequest) {
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") return fail(null, -32600, "Invalid Request");
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case "initialize": {
      const requested = String(msg.params?.protocolVersion ?? "");
      return ok(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Live market data for crypto, forex, US stocks and Indian NSE stocks. Use list_symbols for valid ids, " +
          "get_quote/get_quotes for live prices, get_candles for history, market_overview for a daily summary. " +
          "Data is informational only, not investment advice.",
      });
    }
    case "ping":
      return ok(msg.id, {});
    case "tools/list":
      return ok(msg.id, {
        tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema, annotations: readOnly })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return fail(msg.id, -32602, `Unknown tool: ${String(msg.params?.name)}`);
      try {
        const data = await tool.run((msg.params?.arguments as Record<string, unknown>) ?? {});
        const structured = Array.isArray(data) ? { items: data } : (data as Record<string, unknown>);
        return ok(msg.id, { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: structured });
      } catch (e) {
        return ok(msg.id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    }
    default:
      return fail(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
