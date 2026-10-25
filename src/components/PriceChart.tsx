"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCompact, formatPrice } from "@/lib/format";
import { findSymbol } from "@/lib/symbols";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

const INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];
const MAX_BARS = 240;
const W = 600;
const H = 260;
const PRICE_H = H * 0.8; // top 80% candles, bottom 20% volume

/** Insert or replace the candle that starts at `c.time`, keeping the series sorted and capped. */
function upsert(candles: Candle[], c: Candle) {
  const last = candles[candles.length - 1];
  if (!last || c.time > last.time) return [...candles, c].slice(-MAX_BARS);
  if (c.time === last.time) return [...candles.slice(0, -1), c];
  return candles;
}

export function PriceChart({ symbol, livePrice }: { symbol: string; livePrice?: number }) {
  const [interval, setBarSize] = useState<Interval>("1m");
  const [mode, setMode] = useState<"candles" | "line">("candles");
  const key = `${symbol}:${interval}`;
  const [data, setData] = useState<{ key: string; candles: Candle[]; error?: string }>({ key: "", candles: [] });
  const [hover, setHover] = useState<number | null>(null);
  const pair = findSymbol(symbol)?.binance;

  // Initial history + periodic refresh (catches new bars for markets without a stream).
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/v1/candles?symbol=${symbol}&interval=${interval}`)
        .then((r) => r.json())
        .then((d) => !cancelled && setData({ key, candles: d.candles ?? [], error: d.error }))
        .catch((e) => !cancelled && setData({ key, candles: [], error: String(e) }));
    load();
    const timer = setInterval(load, pair ? 300_000 : interval === "1m" ? 15_000 : 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, interval, key, pair]);

  // Crypto: Binance pushes the forming candle every second, and a new one at each bar boundary.
  useEffect(() => {
    if (!pair) return;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${pair.toLowerCase()}@kline_${interval}`);
    ws.onmessage = (ev) => {
      const { k } = JSON.parse(ev.data) as { k: { t: number; o: string; h: string; l: string; c: string; v: string } };
      const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
      setData((d) => (d.key === key && d.candles.length ? { ...d, candles: upsert(d.candles, c) } : d));
    };
    return () => ws.close();
  }, [pair, interval, key]);

  const loading = data.key !== key;
  const candles = useMemo(() => {
    // Non-crypto: fold the latest polled quote into the forming candle so it moves between refreshes.
    if (pair || loading || livePrice == null || !data.candles.length) return data.candles;
    const last = data.candles[data.candles.length - 1];
    const live = { ...last, close: livePrice, high: Math.max(last.high, livePrice), low: Math.min(last.low, livePrice) };
    return [...data.candles.slice(0, -1), live];
  }, [data, loading, livePrice, pair]);

  const geom = useMemo(() => {
    if (candles.length < 2) return null;
    const min = Math.min(...candles.map((c) => (mode === "candles" ? c.low : c.close)));
    const max = Math.max(...candles.map((c) => (mode === "candles" ? c.high : c.close)));
    const pad = (max - min) * 0.08 || 1;
    const lo = min - pad;
    const hi = max + pad;
    const step = W / candles.length;
    const x = (i: number) => i * step + step / 2;
    const y = (v: number) => PRICE_H - ((v - lo) / (hi - lo)) * PRICE_H;
    const maxVol = Math.max(...candles.map((c) => c.volume)) || 1;
    const line = candles.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(c.close).toFixed(1)}`).join("");
    return { x, y, step, maxVol, line, lo, hi };
  }, [candles, mode]);

  const last = candles[candles.length - 1];
  const point = hover != null ? candles[hover] : last;
  const showTime = (t: number) =>
    new Date(t * 1000).toLocaleString("en-IN", interval === "1d" ? { dateStyle: "medium" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const ticks = geom ? [0, 0.25, 0.5, 0.75, 1].map((f) => geom.lo + (geom.hi - geom.lo) * (1 - f)) : [];
  const timeTicks = candles.length ? [0.1, 0.5, 0.9].map((f) => Math.floor(f * (candles.length - 1))) : [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-panel-2 p-1">
          {INTERVALS.map((i) => (
            <button
              key={i}
              onClick={() => setBarSize(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${i === interval ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
            >
              {i.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg bg-panel-2 p-1">
          {(["candles", "line"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize ${m === mode ? "bg-background text-foreground" : "text-muted hover:text-foreground"}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-2 flex h-5 flex-wrap gap-x-3 font-mono text-xs text-muted tabular">
        {point && !loading && (
          <>
            <span>{showTime(point.time)}</span>
            <span>O <b className="font-normal text-foreground">{formatPrice(point.open)}</b></span>
            <span>H <b className="font-normal text-foreground">{formatPrice(point.high)}</b></span>
            <span>L <b className="font-normal text-foreground">{formatPrice(point.low)}</b></span>
            <span>C <b className={`font-normal ${point.close >= point.open ? "text-up" : "text-down"}`}>{formatPrice(point.close)}</b></span>
            <span>V {formatCompact(point.volume)}</span>
          </>
        )}
      </div>

      <div className="relative pr-16">
        {loading && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading chart…</div>}
        {!loading && !geom && <div className="absolute inset-0 grid place-items-center text-sm text-muted">{data.error ?? "No data yet"}</div>}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-64 w-full"
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            if (!geom) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.floor(((e.clientX - rect.left) / rect.width) * candles.length);
            setHover(Math.max(0, Math.min(candles.length - 1, i)));
          }}
        >
          {geom && !loading && (
            <>
              {ticks.map((t) => (
                <line key={t} x1="0" x2={W} y1={geom.y(t)} y2={geom.y(t)} stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
              {candles.map((c, i) => {
                const up = c.close >= c.open;
                const color = up ? "var(--up)" : "var(--down)";
                const volH = (c.volume / geom.maxVol) * (H - PRICE_H - 4);
                const bw = Math.max(geom.step * 0.7, 0.6);
                return (
                  <g key={c.time}>
                    <rect x={geom.x(i) - bw / 2} y={H - volH} width={bw} height={volH} fill={color} opacity="0.3" />
                    {mode === "candles" && (
                      <>
                        <line x1={geom.x(i)} x2={geom.x(i)} y1={geom.y(c.high)} y2={geom.y(c.low)} stroke={color} strokeWidth="1" vectorEffect="non-scaling-stroke" />
                        <rect
                          x={geom.x(i) - bw / 2}
                          y={geom.y(Math.max(c.open, c.close))}
                          width={bw}
                          height={Math.max(Math.abs(geom.y(c.open) - geom.y(c.close)), 0.8)}
                          fill={color}
                        />
                      </>
                    )}
                  </g>
                );
              })}
              {mode === "line" && <path d={geom.line} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
              {last && (
                <line x1="0" x2={W} y1={geom.y(last.close)} y2={geom.y(last.close)} stroke="var(--accent)" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
              {hover != null && (
                <line x1={geom.x(hover)} x2={geom.x(hover)} y1="0" y2={H} stroke="var(--muted)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              )}
            </>
          )}
        </svg>

        {/* Price axis as HTML so labels don't stretch with the SVG. */}
        {geom && !loading && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 text-[10px] text-muted tabular">
            {ticks.map((t) => (
              <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(geom.y(t) / H) * 100}%` }}>
                {formatPrice(t)}
              </span>
            ))}
            {last && (
              <span
                className="absolute right-0 -translate-y-1/2 rounded bg-accent px-1 py-0.5 font-medium text-white"
                style={{ top: `${(geom.y(last.close) / H) * 100}%` }}
              >
                {formatPrice(last.close)}
              </span>
            )}
          </div>
        )}
      </div>

      {!loading && candles.length > 0 && (
        <div className="relative mr-16 mt-1 h-4 text-[10px] text-muted">
          {timeTicks.map((i) => (
            <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / candles.length) * 100}%` }}>
              {showTime(candles[i].time)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
