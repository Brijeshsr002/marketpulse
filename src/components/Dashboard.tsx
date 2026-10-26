"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatChange, formatCompact, formatPercent, formatPrice } from "@/lib/format";
import { MARKETS, SYMBOLS, type Market } from "@/lib/symbols";
import { PriceChart } from "./PriceChart";

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

/** Per-symbol feed health: when data last arrived, and the last error if the API failed. */
type Feed = { okAt: number; error?: string };

const POLL_MS = 3_000;
const STALE_MS = 15_000; // no data for this long = feed disconnected
const CLOSED_MS = 5 * 60_000; // last trade older than this = market not trading
const CRYPTO = SYMBOLS.filter((s) => s.binance);
const PAIR_TO_ID = new Map(CRYPTO.map((s) => [s.binance!, s.id]));

export function Dashboard() {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [feeds, setFeeds] = useState<Record<string, Feed>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});
  const [selected, setSelected] = useState("BTC");
  const [stream, setStream] = useState(false);
  const [now, setNow] = useState(0);
  const prices = useRef<Record<string, number>>({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  // REST polling covers every market (and is the crypto fallback if the socket drops).
  useEffect(() => {
    function apply(updates: Quote[], errors: { id: string; error: string }[]) {
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
      setFeeds((cur) => {
        const next = { ...cur };
        const at = Date.now();
        for (const q of updates) next[q.id] = { okAt: at };
        for (const e of errors) next[e.id] = { okAt: cur[e.id]?.okAt ?? 0, error: e.error };
        return next;
      });
      if (Object.keys(flashes).length) setFlash(flashes);
    }

    let cancelled = false;
    const load = () =>
      fetch("/api/v1/quotes")
        .then((r) => r.json())
        .then((d) => !cancelled && apply(d.quotes ?? [], d.errors ?? []))
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
      ws.onopen = () => setStream(true);
      ws.onclose = () => {
        setStream(false);
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
        setFeeds((cur) => ({ ...cur, [id]: { okAt: Date.now() } }));
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

  const all = useMemo(() => SYMBOLS.map((s) => quotes[s.id]).filter(Boolean), [quotes]);
  const movers = useMemo(() => [...all].sort((a, b) => b.changePercent - a.changePercent), [all]);
  const current = quotes[selected];
  const info = SYMBOLS.find((s) => s.id === selected)!;

  const connected = (id: string) => {
    const f = feeds[id];
    return f != null && !f.error && now - f.okAt < STALE_MS;
  };
  const trading = (q?: Quote) => q != null && (SYMBOLS.find((s) => s.id === q.id)?.binance != null || now - Date.parse(q.time) < CLOSED_MS);
  const connectedCount = SYMBOLS.filter((s) => connected(s.id)).length;

  return (
    <div className="flex min-h-full flex-col">
      <TickerTape quotes={all} onPick={setSelected} />

      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 px-4 py-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar: every market, grouped. Green dot = API delivering data for that symbol. */}
        <aside className="max-h-72 overflow-y-auto rounded-xl border border-border bg-panel lg:sticky lg:top-4 lg:max-h-[calc(100dvh-120px)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-muted">
            <span className="font-semibold uppercase tracking-wide">Markets</span>
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${connectedCount ? "bg-up" : "bg-down"}`} />
              {connectedCount}/{SYMBOLS.length} connected
            </span>
          </div>
          {MARKETS.map((m) => {
            const items = SYMBOLS.filter((s) => s.market === m.id);
            const ok = items.filter((s) => connected(s.id)).length;
            return (
              <div key={m.id}>
                <div className="flex items-center justify-between bg-panel-2/60 px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted">
                  <span>{m.label}</span>
                  <span className={ok === items.length ? "text-up" : ok ? "text-foreground" : "text-down"}>
                    {ok}/{items.length}
                  </span>
                </div>
                {items.map((s) => {
                  const q = quotes[s.id];
                  const f = feeds[s.id];
                  const isOn = connected(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      title={f?.error ? `API error: ${f.error}` : isOn ? "API connected" : "Waiting for data"}
                      className={`flex w-full items-center gap-2.5 border-l-2 px-4 py-2 text-left hover:bg-panel-2 ${selected === s.id ? "border-accent bg-panel-2" : "border-transparent"}`}
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${isOn ? "bg-up" : f?.error ? "bg-down" : "bg-muted"} ${isOn && trading(q) ? "animate-pulse" : ""}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-medium ${isOn ? "text-up" : ""}`}>{s.id}</span>
                        <span className="block truncate text-[11px] text-muted">
                          {s.name}
                          {q && !trading(q) && " · closed"}
                        </span>
                      </span>
                      {q && (
                        <span className="text-right">
                          <span
                            key={`${s.id}-${q.price}`}
                            className={`block rounded px-1 font-mono text-xs tabular ${flash[s.id] === "up" ? "flash-up" : flash[s.id] === "down" ? "flash-down" : ""}`}
                          >
                            {formatPrice(q.price)}
                          </span>
                          <span className={`block text-[11px] tabular ${q.change >= 0 ? "text-up" : "text-down"}`}>{formatPercent(q.changePercent)}</span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </aside>

        <main className="min-w-0 space-y-4">
          {/* Main chart */}
          <section className="rounded-xl border border-border bg-panel p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted">
                  {MARKETS.find((m) => m.id === info.market)?.label}
                  <span className={`flex items-center gap-1 normal-case tracking-normal ${connected(selected) ? "text-up" : "text-down"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${connected(selected) ? "bg-up" : "bg-down"}`} />
                    {connected(selected) ? (info.binance && stream ? "Live stream" : "API connected") : "Not connected"}
                  </span>
                  {current && !trading(current) && <span className="rounded bg-panel-2 px-1.5 py-0.5 normal-case tracking-normal">Market closed</span>}
                </div>
                <h1 className="mt-1 text-2xl font-semibold">
                  {info.id} <span className="text-base font-normal text-muted">{info.name}</span>
                </h1>
                {current && (
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="font-mono text-3xl font-semibold tabular">{formatPrice(current.price)}</span>
                    <span className={`text-sm font-medium tabular ${current.change >= 0 ? "text-up" : "text-down"}`}>
                      {formatChange(current.change)} ({formatPercent(current.changePercent)})
                    </span>
                    <span className="text-xs text-muted">{current.currency}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {current && (
                  <dl className="flex gap-2 text-sm">
                    <Stat label="High" value={current.dayHigh != null ? formatPrice(current.dayHigh) : "—"} />
                    <Stat label="Low" value={current.dayLow != null ? formatPrice(current.dayLow) : "—"} />
                    <Stat label="Volume" value={formatCompact(current.volume)} />
                  </dl>
                )}
                <Link href={`/chart/${selected}`} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
                  ⛶ Full screen
                </Link>
              </div>
            </div>
            <PriceChart key={selected} symbol={selected} className="h-[52vh] min-h-72" />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            {movers.length > 0 && <MoverList title="Top gainers" items={movers.slice(0, 5)} onPick={setSelected} />}
            {movers.length > 0 && <MoverList title="Top losers" items={movers.slice(-5).reverse()} onPick={setSelected} />}
            <div className="rounded-xl border border-border bg-panel p-5">
              <h3 className="font-semibold">Ask your AI agent</h3>
              <p className="mt-1 text-sm text-muted">Every price here is available to Claude over MCP.</p>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted">{`analyze_market({ symbol: "${selected}" })`}</pre>
              <Link href="/docs#mcp" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                Connect Claude →
              </Link>
            </div>
          </section>

          <p className="text-xs text-muted">
            Green dot = API connected and sending data for that symbol. Crypto streams live from Binance; forex, US and NSE come from Yahoo Finance (may be delayed). For information
            only, not investment advice.
          </p>
        </main>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-1.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-mono text-sm tabular">{value}</dd>
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
