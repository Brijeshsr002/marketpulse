import type { Metadata } from "next";
import Link from "next/link";
import { Code } from "@/components/Code";
import { MARKETS, SYMBOLS } from "@/lib/symbols";

export const metadata: Metadata = {
  title: "AI Docs — MarketPulse",
  description: "Connect Claude, n8n, Sendiee or any AI agent to live market data with MCP or REST.",
};

const SECTIONS = [
  ["quickstart", "Quickstart"],
  ["mcp", "Connect via MCP"],
  ["tools", "MCP tools"],
  ["rest", "REST API"],
  ["n8n", "n8n"],
  ["sendiee", "Sendiee"],
  ["symbols", "Symbols"],
  ["auth", "Auth & limits"],
] as const;

const TOOLS = [
  ["list_symbols", "market?", "Every symbol id, name and market. Agents call this first."],
  ["get_quote", "symbol", "Live price, change, % change, day high/low, volume."],
  ["get_quotes", "symbols[]? · market?", "Several quotes at once, or a whole market."],
  ["get_candles", "symbol · range?", "OHLCV history: 1d, 5d, 1mo, 6mo, 1y."],
  ["market_overview", "—", "All markets plus top 5 gainers and losers."],
];

export default function DocsPage() {
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-6 space-y-1 text-sm">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="block rounded-md px-3 py-1.5 text-muted hover:bg-panel hover:text-foreground">
              {label}
            </a>
          ))}
          <a href="/llms.txt" className="block rounded-md px-3 py-1.5 text-muted hover:bg-panel hover:text-foreground">llms.txt ↗</a>
        </nav>
      </aside>

      <article className="min-w-0 max-w-3xl space-y-14 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:font-semibold [&_p]:leading-relaxed [&_p]:text-muted">
        <header>
          <p className="text-sm font-medium !text-accent">AI Docs</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Give your AI agent live market data</h1>
          <p className="mt-3 text-lg">
            MarketPulse serves live crypto, forex, US and India NSE prices through an <strong className="text-foreground">MCP server</strong> and a{" "}
            <strong className="text-foreground">REST API</strong>. Plug it into Claude, n8n, Sendiee or any agent framework in a minute.
          </p>
        </header>

        <section id="quickstart">
          <h2>Quickstart</h2>
          <p>Try it from a terminal. No API key is needed for public market data.</p>
          <Code lang="bash" code={`curl "{{BASE}}/api/v1/quotes?symbols=BTC,AAPL,NIFTY,USDINR"`} />
          <Code
            lang="json"
            code={`{
  "asOf": "2026-10-25T09:30:00.000Z",
  "quotes": [
    { "id": "BTC", "name": "Bitcoin", "market": "crypto", "price": 98234.51,
      "change": 1210.4, "changePercent": 1.25, "dayHigh": 98800, "dayLow": 96510,
      "volume": 2.1e10, "currency": "USDT", "time": "2026-10-25T09:29:59.000Z" }
  ],
  "errors": []
}`}
          />
        </section>

        <section id="mcp">
          <h2>Connect via MCP</h2>
          <p>
            The <a className="text-accent hover:underline" href="https://modelcontextprotocol.io">Model Context Protocol</a> lets an AI agent discover and call our tools
            itself. Server URL (Streamable HTTP, stateless):
          </p>
          <Code code={`{{BASE}}/api/mcp`} />

          <h3>Claude (claude.ai and Claude Desktop)</h3>
          <p>
            Settings → Connectors → <em>Add custom connector</em>. Name it <code>MarketPulse</code> and paste the server URL above. Then ask: “How is the Nifty doing today versus Bitcoin?”
          </p>

          <h3>Claude Code</h3>
          <Code lang="bash" code={`claude mcp add --transport http marketpulse {{BASE}}/api/mcp`} />

          <h3>Cursor, Windsurf and other MCP clients</h3>
          <Code
            lang="json"
            code={`{
  "mcpServers": {
    "marketpulse": { "url": "{{BASE}}/api/mcp" }
  }
}`}
          />

          <h3>Raw JSON-RPC</h3>
          <p>Any HTTP client can talk MCP directly:</p>
          <Code
            lang="bash"
            code={`curl -X POST {{BASE}}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_quote","arguments":{"symbol":"RELIANCE"}}}'`}
          />
        </section>

        <section id="tools">
          <h2>MCP tools</h2>
          <p>All tools are read-only. Results come back as JSON text and as <code>structuredContent</code>.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-panel text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">Tool</th>
                  <th className="px-4 py-2">Arguments</th>
                  <th className="px-4 py-2">Returns</th>
                </tr>
              </thead>
              <tbody>
                {TOOLS.map(([name, args, desc]) => (
                  <tr key={name} className="border-t border-border">
                    <td className="px-4 py-2.5 font-mono text-accent">{name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">{args}</td>
                    <td className="px-4 py-2.5 text-muted">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="rest">
          <h2>REST API</h2>
          <p>Plain GET endpoints returning JSON, with CORS enabled. Use them from n8n HTTP nodes, Sendiee tools, Zapier, Make or your own code.</p>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["/api/v1/symbols", "?market=crypto|forex|us|nse", "List symbols"],
              ["/api/v1/quotes", "?symbols=BTC,AAPL  or  ?market=nse", "Live quotes"],
              ["/api/v1/candles", "?symbol=BTC&range=1d|5d|1mo|6mo|1y", "OHLCV history"],
              ["/api/v1/overview", "", "All markets plus top gainers/losers"],
            ].map(([path, query, desc]) => (
              <div key={path} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-panel px-4 py-3">
                <span className="rounded bg-up/15 px-1.5 py-0.5 text-xs font-semibold text-up">GET</span>
                <code className="font-mono">{path}</code>
                <code className="font-mono text-xs text-muted">{query}</code>
                <span className="ml-auto text-muted">{desc}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="n8n">
          <h2>n8n</h2>
          <h3>Option A: as a tool for an n8n AI Agent</h3>
          <p>
            Add an <strong className="text-foreground">AI Agent</strong> node, then attach an <strong className="text-foreground">MCP Client Tool</strong> node to its Tool input.
            Set <em>Endpoint</em> to the URL below and <em>Server Transport</em> to <em>HTTP Streamable</em>. The agent will discover all five tools automatically.
          </p>
          <Code code={`{{BASE}}/api/mcp`} />
          <h3>Option B: scheduled market alerts</h3>
          <p>
            <em>Schedule Trigger</em> (e.g. 9:15 AM IST) → <em>HTTP Request</em> GET <code>{"{{BASE}}"}/api/v1/overview</code> → <em>AI Agent</em> to summarise →
            send it to WhatsApp, Slack or email.
          </p>
          <Code lang="http" code={`GET {{BASE}}/api/v1/quotes?market=nse`} />
        </section>

        <section id="sendiee">
          <h2>Sendiee (WhatsApp AI assistant)</h2>
          <p>
            Give your Sendiee assistant a live-price tool so customers can ask on WhatsApp, for example “Gold rate now?” or “How is Reliance today?”. In the assistant’s tools, add an
            API/function tool that calls:
          </p>
          <Code lang="http" code={`GET {{BASE}}/api/v1/quotes?symbols={symbol}`} />
          <p>
            Describe the <code>symbol</code> parameter to the assistant as “one of: {SYMBOLS.slice(0, 8).map((s) => s.id).join(", ")}…” and tell it to reply with the price and % change.
            For richer flows, route the assistant through an n8n workflow that uses the MCP Client Tool (Option A above).
          </p>
        </section>

        <section id="symbols">
          <h2>Symbols</h2>
          <p>Use these ids everywhere: site, REST and MCP.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {MARKETS.map((m) => (
              <div key={m.id} className="rounded-xl border border-border bg-panel p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">{m.label}</span>
                  <code className="text-xs text-muted">market={m.id}</code>
                </div>
                <ul className="space-y-1 text-sm">
                  {SYMBOLS.filter((s) => s.market === m.id).map((s) => (
                    <li key={s.id} className="flex justify-between gap-2">
                      <code className="font-mono text-accent">{s.id}</code>
                      <span className="truncate text-muted">{s.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section id="auth">
          <h2>Auth & limits</h2>
          <p>
            Public by default. To lock the MCP endpoint, set <code>MCP_API_KEY</code> in your deployment. Clients then send <code>Authorization: Bearer &lt;key&gt;</code>, or append{" "}
            <code>?key=&lt;key&gt;</code> to the server URL for clients that can’t set headers.
          </p>
          <p className="mt-3">
            Crypto comes in real time from Binance. Stocks, forex and NSE come from Yahoo Finance and may be delayed up to 15 minutes. Responses are cached for 5 seconds (quotes) and 30 seconds
            (candles). Data is for information only, not investment advice.
          </p>
          <p className="mt-3">
            <Link href="/" className="text-accent hover:underline">← Back to live markets</Link>
          </p>
        </section>
      </article>
    </div>
  );
}
