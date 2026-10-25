"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatChange, formatCompact, formatPercent, formatPrice } from "@/lib/format";
import { MARKETS, SYMBOLS, type Market } from "@/lib/symbols";
import { PriceChart } from "./PriceChart";
import { Sparkline } from "./Sparkline";

type Quote = {
  id: string;
  name: string;
  market: Market;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  currency: string;
  time: string;
  spark: number[];
};

type Tab = Market | "all";

const POLL_MS = 10_000;
const CRYPTO = SYMBOLS.filter((s) => s.binance);
const PAIR_TO_ID = new Map(CRYPTO.map((s) => [s.binance!, s.id]));

export function Dashboard() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState("BTC");
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const prices = useRef<Record<string, number>>({});

  // REST polling covers every market (and is the crypto fallback if the socket drops).
  useEffect(() => {
    function apply(updates: Quote[]) {
      const flashes: Record<string, "up" | "down"> = {};
      for (const q of updates) {
        const prev = prices.current[q.id];
        if (prev != null && prev !== q.price) flashes[q.id] = q.price > prev ? "up" : "down";
        prices.current[q.id] = q.price;
      }
      setQuotes((cur) => {
        const next = { ...cur };
        for (const q of updates) next[q.id] = { ...cur[q.id], ...q, spark: q.spark?.length ? q.spark : (cur[q.id]?.spark ?? []) };
        return next;
      });
      if (Object.keys(flashes).length) setFlash(flashes);
      setUpdatedAt(new Date());
    }

    let cancelled = false;
    const load = () =>
      fetch("/api/v1/quotes")
        .then((r) => r.json())
        .then((d) => !cancelled && apply(d.quotes ?? []))
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Tick-by-tick crypto prices straight from Binance's public stream.
  useEffect(() => {
    const streams = CRYPTO.map((s) => `${s.binance!.toLowerCase()}@miniTicker`).join("/");
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
      ws.onopen = () => setLive(true);
      ws.onclose = () => {
        setLive(false);
        if (!closed) retry = setTimeout(connect, 5_000);
      };
      ws.onmessage = (ev) => {
        const { data: t } = JSON.parse(ev.data) as { data: { s: string; c: string; o: string; h: string; l: string; q: string; E: number } };
        const id = PAIR_TO_ID.get(t.s);
        if (!id) return;
        const price = +t.c;
        const open = +t.o;
        setQuotes((cur) => {
          if (!cur[id]) return cur;
          return { ...cur, [id]: { ...cur[id], price, change: price - open, changePercent: ((price - open) / open) * 100, dayHigh: +t.h, dayLow: +t.l, volume: +t.q, time: new Date(t.E).toISOString() } };
        });
        const prev = prices.current[id];
        if (prev != null && prev !== price) setFlash({ [id]: price > prev ? "up" : "down" });
        prices.current[id] = price;
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const list = useMemo(
    () => SYMBOLS.filter((s) => tab === "all" || s.market === tab).map((s) => quotes[s.id]).filter(Boolean),
    [quotes, tab],
  );
  const all = useMemo(() => SYMBOLS.map((s) => quotes[s.id]).filter(Boolean), [quotes]);
  const movers = useMemo(() => [...all].sort((a, b) => b.changePercent - a.changePercent), [all]);
  const current = quotes[selected];

  return (
    <div className="flex min-h-full flex-col">
      <TickerTape quotes={all} onPick={setSelected} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">Live markets, ready for AI agents</h1>
            <p className="mt-1 text-sm text-muted">
              Crypto, Forex, US stocks and India NSE in one place. Connect Claude, n8n or Sendiee through MCP.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${live ? "bg-up animate-pulse" : "bg-muted"}`} />
              {live ? "Crypto streaming live" : "Connecting stream…"}
            </span>
            {updatedAt && <span className="tabular">Updated {updatedAt.toLocaleTimeString()}</span>}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <section className="min-w-0">
            <div className="mb-3 flex gap-1 overflow-x-auto rounded-xl border border-border bg-panel p-1">
              {([{ id: "all", label: "All" }, ...MARKETS] as { id: Tab; label: string }[]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTab(m.id)}
                  className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${tab === m.id ? "bg-panel-2 text-foreground" : "text-muted hover:text-foreground"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-panel">
              <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-4 py-2 text-xs uppercase tracking-wide text-muted sm:grid-cols-[1fr_120px_110px_100px]">
                <span>Symbol</span>
                <span className="text-right">Price</span>
                <span className="text-right">24h / Day</span>
                <span className="hidden sm:block" />
              </div>
              {list.length === 0 && <div className="px-4 py-10 text-center text-sm text-muted">Loading live prices…</div>}
              {list.map((q) => {
                const up = q.change >= 0;
                return (
                  <button
                    key={q.id}
                    onClick={() => setSelected(q.id)}
                    className={`grid w-full grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-panel-2 sm:grid-cols-[1fr_120px_110px_100px] ${selected === q.id ? "bg-panel-2" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{q.id}</span>
                      <span className="block truncate text-xs text-muted">{q.name}</span>
                    </span>
                    <span key={`${q.id}-${q.price}`} className={`rounded px-1 text-right font-mono tabular ${flash[q.id] === "up" ? "flash-up" : flash[q.id] === "down" ? "flash-down" : ""}`}>
                      {formatPrice(q.price)}
                    </span>
                    <span className={`text-right text-sm font-medium tabular ${up ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</span>
                    <Sparkline data={q.spark} up={up} className="hidden h-8 w-full sm:block" />
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-xl border border-border bg-panel p-5">
              {current ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted">{MARKETS.find((m) => m.id === current.market)?.label}</div>
                      <h2 className="text-xl font-semibold">
                        {current.id} <span className="text-sm font-normal text-muted">{current.name}</span>
                      </h2>
                    </div>
                    <span className="rounded-md bg-panel-2 px-2 py-1 text-xs text-muted">{current.currency}</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-semibold tabular">{formatPrice(current.price)}</span>
                    <span className={`text-sm font-medium tabular ${current.change >= 0 ? "text-up" : "text-down"}`}>
                      {formatChange(current.change)} ({formatPercent(current.changePercent)})
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <Stat label="High" value={current.dayHigh != null ? formatPrice(current.dayHigh) : "—"} />
                    <Stat label="Low" value={current.dayLow != null ? formatPrice(current.dayLow) : "—"} />
                    <Stat label="Volume" value={formatCompact(current.volume)} />
                  </dl>
                  <div className="mt-5">
                    <PriceChart symbol={current.id} livePrice={current.price} />
                  </div>
                </>
              ) : (
                <div className="py-24 text-center text-sm text-muted">Loading…</div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-panel p-5">
              <h3 className="font-semibold">Ask your AI agent</h3>
              <p className="mt-1 text-sm text-muted">Every price here is available to AI agents over MCP and REST.</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted">
                {`"What's ${selected} doing today?"\n→ get_quote({ symbol: "${selected}" })`}
              </pre>
              <Link href="/docs#mcp" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                Connect Claude, n8n or Sendiee →
              </Link>
            </div>
          </aside>
        </div>

        {movers.length > 0 && (
          <section className="mt-8 grid gap-6 md:grid-cols-2">
            <MoverList title="Top gainers" items={movers.slice(0, 5)} onPick={setSelected} />
            <MoverList title="Top losers" items={movers.slice(-5).reverse()} onPick={setSelected} />
          </section>
        )}

        <p className="mt-10 text-xs text-muted">
          Data from Binance (crypto, real-time) and Yahoo Finance (stocks, forex, NSE; may be delayed). For information only, not investment advice.
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono tabular">{value}</dd>
    </div>
  );
}

function MoverList({ title, items, onPick }: { title: string; items: Quote[]; onPick: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-5">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <ul className="space-y-1">
        {items.map((q) => (
          <li key={q.id}>
            <button onClick={() => onPick(q.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-panel-2">
              <span>
                <span className="font-medium">{q.id}</span> <span className="text-muted">{q.name}</span>
              </span>
              <span className={`font-medium tabular ${q.change >= 0 ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TickerTape({ quotes, onPick }: { quotes: Quote[]; onPick: (id: string) => void }) {
  if (!quotes.length) return <div className="h-9 border-b border-border bg-panel" />;
  const items = [...quotes, ...quotes];
  return (
    <div className="overflow-hidden border-b border-border bg-panel">
      <div className="ticker-track flex w-max gap-8 py-2 text-sm">
        {items.map((q, i) => (
          <button key={`${q.id}-${i}`} onClick={() => onPick(q.id)} className="flex items-center gap-2 whitespace-nowrap">
            <span className="font-medium">{q.id}</span>
            <span className="font-mono tabular">{formatPrice(q.price)}</span>
            <span className={`tabular ${q.change >= 0 ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
