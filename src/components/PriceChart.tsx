"use client";

import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

const RANGES = ["1d", "5d", "1mo", "6mo", "1y"] as const;
const W = 600;
const H = 240;

export function PriceChart({ symbol, livePrice }: { symbol: string; livePrice?: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>("1d");
  const key = `${symbol}:${range}`;
  const [data, setData] = useState<{ key: string; candles: Candle[]; error?: string }>({ key: "", candles: [] });
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/v1/candles?symbol=${symbol}&range=${range}`)
        .then((r) => r.json())
        .then((d) => !cancelled && setData({ key, candles: d.candles ?? [], error: d.error }))
        .catch((e) => !cancelled && setData({ key, candles: [], error: String(e) }));
    load();
    const timer = setInterval(load, range === "1d" ? 30_000 : 300_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol, range, key]);

  const loading = data.key !== key;
  const candles = useMemo(() => {
    // Extend the intraday line with the live tick so the chart moves with the price.
    if (loading || range !== "1d" || livePrice == null || !data.candles.length) return data.candles;
    const last = data.candles[data.candles.length - 1];
    return [...data.candles.slice(0, -1), { ...last, close: livePrice }];
  }, [data, loading, range, livePrice]);

  const geom = useMemo(() => {
    if (candles.length < 2) return null;
    const closes = candles.map((c) => c.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const pad = (max - min) * 0.08 || 1;
    const x = (i: number) => (i / (candles.length - 1)) * W;
    const y = (v: number) => H - ((v - (min - pad)) / (max - min + 2 * pad)) * H;
    const line = candles.map((c, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(c.close).toFixed(1)}`).join("");
    return { x, y, line, area: `${line}L${W},${H}L0,${H}Z`, min, max, up: closes[closes.length - 1] >= closes[0] };
  }, [candles]);

  const point = hover != null ? candles[hover] : null;
  const color = geom?.up === false ? "var(--down)" : "var(--up)";
  const fmtTime = (t: number) =>
    new Date(t * 1000).toLocaleString("en-IN", range === "1d" || range === "5d" ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-sm text-muted tabular h-5">
          {point ? `${fmtTime(point.time)} · ${formatPrice(point.close)}` : geom ? `Range ${formatPrice(geom.min)} – ${formatPrice(geom.max)}` : ""}
        </div>
        <div className="flex gap-1 rounded-lg bg-panel-2 p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${r === range ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        {loading && <div className="absolute inset-0 grid place-items-center text-sm text-muted">Loading chart…</div>}
        {!loading && !geom && <div className="absolute inset-0 grid place-items-center text-sm text-muted">{data.error ?? "No data for this range"}</div>}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-60 w-full"
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            if (!geom) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - rect.left) / rect.width) * (candles.length - 1));
            setHover(Math.max(0, Math.min(candles.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {geom && !loading && (
            <>
              <path d={geom.area} fill="url(#fill)" />
              <path d={geom.line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
              {point && hover != null && (
                <>
                  <line x1={geom.x(hover)} x2={geom.x(hover)} y1="0" y2={H} stroke="var(--muted)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                  <circle cx={geom.x(hover)} cy={geom.y(point.close)} r="4" fill={color} />
                </>
              )}
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
