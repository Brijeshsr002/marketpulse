"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { nextCandleSignal, type Bar } from "@/lib/indicators";
import { MARKETS, SYMBOLS } from "@/lib/symbols";

type Call = {
  id: string;
  symbol: string;
  side: "UP" | "DOWN";
  reason: string;
  /** Unix start time of the candle being called. */
  target: number;
  result?: "WIN" | "LOSS" | "TIE";
  open?: number;
  close?: number;
};

const STORE = "mp-signals-v1";
const PAYOUT = 0.85; // typical binary-options payout on a win
const STAKE = 100; // demo stake per trade, ₹
const BREAK_EVEN = 100 / (1 + PAYOUT); // ≈ 54.1% win rate needed to not lose money

function loadCalls(): Call[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {
    return [];
  }
}

function saveCalls(calls: Call[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(calls.slice(0, 1000)));
  } catch {}
}

export function SignalTracker() {
  const [symbol, setSymbol] = useState("BTC");
  const [bars, setBars] = useState<Bar[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [auto, setAuto] = useState(false);
  const [now, setNow] = useState(0);

  useEffect(() => {
    // Restore history after mount (localStorage is browser-only).
    const restored = loadCalls();
    queueMicrotask(() => setCalls(restored));
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1_000);
    return () => clearInterval(timer);
  }, []);

  // 1-minute candles for the selected symbol, refreshed every 3s.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/v1/candles?symbol=${symbol}&interval=1m`)
        .then((r) => r.json())
        .then((d) => !cancelled && setBars(d.candles ?? []))
        .catch(() => {});
    load();
    const timer = setInterval(load, 3_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol]);

  const forming = bars.at(-1);
  const closed = useMemo(() => bars.slice(0, -1), [bars]);
  const signal = useMemo(() => nextCandleSignal(closed), [closed]);
  const marketOpen = forming != null && now - forming.time < 180;
  const nextStart = forming ? forming.time + 60 : 0;

  function update(next: Call[]) {
    setCalls(next);
    saveCalls(next);
  }

  function makeCall(sym = symbol) {
    if (!signal || !forming || !marketOpen) return;
    if (calls.some((c) => c.symbol === sym && c.target === nextStart)) return;
    update([{ id: `${sym}-${nextStart}`, symbol: sym, side: signal.side, reason: signal.reason, target: nextStart }, ...calls]);
  }

  // Score pending calls once their candle has closed (a newer bar exists).
  useEffect(() => {
    const byTime = new Map(bars.map((b, i) => [b.time, i]));
    let changed = false;
    const next = calls.map((c) => {
      if (c.result || c.symbol !== symbol) return c;
      const i = byTime.get(c.target);
      if (i == null || i === bars.length - 1) return c;
      const b = bars[i];
      changed = true;
      const result: Call["result"] = b.close === b.open ? "TIE" : (b.close > b.open) === (c.side === "UP") ? "WIN" : "LOSS";
      return { ...c, result, open: b.open, close: b.close };
    });
    if (changed) queueMicrotask(() => update(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  // Auto-test: one call per candle, placed in the first 20s of each minute.
  useEffect(() => {
    if (!auto || !forming || now - forming.time > 20) return;
    queueMicrotask(() => makeCall());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, now, forming?.time]);

  const scored = calls.filter((c) => c.result && c.result !== "TIE");
  const wins = scored.filter((c) => c.result === "WIN").length;
  const winRate = scored.length ? (wins / scored.length) * 100 : 0;
  const pnl = scored.reduce((s, c) => s + (c.result === "WIN" ? STAKE * PAYOUT : -STAKE), 0);
  const pending = calls.filter((c) => !c.result);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-semibold sm:text-3xl">Signal Tracker (demo testing)</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Tests an experimental next-candle rule against real 1-minute candles and scores every call automatically. Mirror calls on a{" "}
        <strong className="text-foreground">demo account only</strong>. Trust the win rate only after 100+ calls.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-panel p-5">
          <div className="flex flex-wrap items-center gap-3">
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="rounded-lg border border-border bg-panel-2 px-3 py-2 font-semibold" aria-label="Symbol">
              {MARKETS.map((m) => (
                <optgroup key={m.id} label={m.label}>
                  {SYMBOLS.filter((s) => s.market === m.id).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} · {s.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <span className="font-mono text-xl tabular">{forming ? formatPrice(forming.close) : "—"}</span>
            <span className={`ml-auto flex items-center gap-1.5 text-xs ${marketOpen ? "text-up" : "text-muted"}`}>
              <span className={`h-2 w-2 rounded-full ${marketOpen ? "bg-up animate-pulse" : "bg-muted"}`} />
              {marketOpen ? "Market live" : "Market closed"}
            </span>
          </div>

          {!marketOpen && forming && (
            <p className="mt-4 rounded-lg bg-panel-2 p-3 text-sm text-muted">
              {symbol} isn’t trading right now. Quotex “OTC” assets are generated by the broker and don’t follow this data, so don’t test against them. Pick a crypto symbol, or come back when the market opens.
            </p>
          )}

          <div className="mt-6 rounded-xl border border-border bg-background p-5 text-center">
            <div className="text-xs uppercase tracking-wide text-muted">Market</div>
            <div className="text-2xl font-semibold">
              {SYMBOLS.find((s) => s.id === symbol)?.name} <span className="text-muted">({symbol})</span>
            </div>
            <div className="mt-4 text-xs uppercase tracking-wide text-muted">Rule says for the next 1-min candle</div>
            {signal && marketOpen ? (
              <>
                <div className={`mt-2 text-5xl font-bold ${signal.side === "UP" ? "text-up" : "text-down"}`}>{signal.side === "UP" ? "▲ UP" : "▼ DOWN"}</div>
                <div className="mt-2 text-sm text-muted">{signal.reason}</div>
                <div className="mt-1 font-mono text-xs text-muted tabular">
                  Candle starts {new Date(nextStart * 1000).toLocaleTimeString("en-IN")} · in {Math.max(0, nextStart - now)}s
                </div>
              </>
            ) : (
              <div className="mt-2 text-2xl text-muted">—</div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => makeCall()}
              disabled={!signal || !marketOpen}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-40"
            >
              Record this call
            </button>
            <button
              onClick={() => setAuto((a) => !a)}
              disabled={!marketOpen}
              className={`flex-1 rounded-lg border px-4 py-2.5 font-medium disabled:opacity-40 ${auto ? "border-up text-up" : "border-border"}`}
            >
              {auto ? "■ Stop auto-test" : "▶ Auto-test every minute"}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted">Auto-test only runs while this tab is open.</p>
        </section>

        <section className="rounded-xl border border-border bg-panel p-5">
          <h2 className="font-semibold">Results</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Scored calls" value={String(scored.length)} />
            <Stat label="Win rate" value={scored.length ? `${winRate.toFixed(1)}%` : "—"} tone={scored.length ? (winRate >= BREAK_EVEN ? "up" : "down") : undefined} />
            <Stat label="Demo P/L" value={`${pnl >= 0 ? "+" : "−"}₹${Math.abs(pnl).toFixed(0)}`} tone={pnl >= 0 ? "up" : "down"} />
            <Stat label="Pending" value={String(pending.length)} />
          </dl>
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-panel-2">
              <div className={`h-full ${winRate >= BREAK_EVEN ? "bg-up" : "bg-down"}`} style={{ width: `${Math.min(winRate, 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Break-even needs <strong className="text-foreground">{BREAK_EVEN.toFixed(1)}%</strong> wins at {PAYOUT * 100}% payout (₹{STAKE} stake).{" "}
              {scored.length < 100 ? `${100 - scored.length} more calls before the number means much.` : "Sample is big enough to judge."}
            </p>
          </div>

          <div className="mt-5 max-h-96 overflow-y-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-panel-2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Candle</th>
                  <th className="px-3 py-2">Symbol</th>
                  <th className="px-3 py-2">Call</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {calls.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-muted">
                      No calls yet
                    </td>
                  </tr>
                )}
                {calls.slice(0, 200).map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs tabular">{new Date(c.target * 1000).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2">{c.symbol}</td>
                    <td className={`px-3 py-2 font-medium ${c.side === "UP" ? "text-up" : "text-down"}`} title={c.reason}>
                      {c.side}
                    </td>
                    <td className="px-3 py-2">
                      {c.result ? (
                        <span className={c.result === "WIN" ? "text-up" : c.result === "LOSS" ? "text-down" : "text-muted"}>{c.result}</span>
                      ) : (
                        <span className="text-muted">waiting…</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {calls.length > 0 && (
            <button onClick={() => confirm("Clear all recorded calls?") && update([])} className="mt-3 text-xs text-muted hover:text-down">
              Clear history
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg bg-panel-2 px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`font-mono text-lg tabular ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{value}</dd>
    </div>
  );
}
