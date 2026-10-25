"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatChange, formatPercent, formatPrice } from "@/lib/format";
import { findSymbol, MARKETS, SYMBOLS } from "@/lib/symbols";
import { PriceChart, type Candle } from "./PriceChart";

type Ref = { previousClose: number; currency: string; time: string };

/** Full-window chart for one symbol: live price header, symbol switcher, fullscreen toggle. */
export function BigChart({ symbol }: { symbol: string }) {
  const router = useRouter();
  const info = findSymbol(symbol)!;
  const box = useRef<HTMLDivElement>(null);
  const [last, setLast] = useState<Candle | null>(null);
  const [ref, setRef] = useState<Ref | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [full, setFull] = useState(false);

  // Previous close / currency change rarely; refresh them every 30s for the % change.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`/api/v1/quotes?symbols=${symbol}`)
        .then((r) => r.json())
        .then((d) => !cancelled && d.quotes?.[0] && setRef(d.quotes[0]))
        .catch(() => {});
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1_000);
    const onFs = () => setFull(document.fullscreenElement != null);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      clearInterval(timer);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  const onLast = useCallback((c: Candle) => setLast(c), []);
  const price = last?.close;
  const change = price != null && ref ? price - ref.previousClose : null;
  const up = (change ?? 0) >= 0;
  // A market is "live" if its latest trade is under 2 minutes old.
  const lastTrade = ref ? Date.parse(ref.time) : 0;
  const live = info.binance != null || (now != null && now.getTime() - lastTrade < 120_000);

  return (
    <div ref={box} className="flex h-[calc(100dvh-57px)] flex-col bg-background px-4 py-3 [&:fullscreen]:h-dvh">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pb-3">
        <select
          value={symbol}
          onChange={(e) => router.push(`/chart/${e.target.value}`)}
          className="rounded-lg border border-border bg-panel px-3 py-2 text-lg font-semibold"
          aria-label="Symbol"
        >
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

        <div className="flex items-baseline gap-3">
          <span className={`font-mono text-4xl font-semibold tabular ${up ? "text-up" : "text-down"}`}>{price != null ? formatPrice(price) : "—"}</span>
          {change != null && ref && (
            <span className={`text-lg font-medium tabular ${up ? "text-up" : "text-down"}`}>
              {formatChange(change)} ({formatPercent((change / ref.previousClose) * 100)})
            </span>
          )}
          {ref && <span className="text-sm text-muted">{ref.currency}</span>}
        </div>

        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-up animate-pulse" : "bg-muted"}`} />
            {live ? (info.binance ? "Live stream" : "Live · updates every 1s") : `Market closed · last trade ${ref ? new Date(lastTrade).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}`}
          </span>
          <span className="font-mono text-muted tabular">{now?.toLocaleTimeString("en-IN")}</span>
          <button
            onClick={() => (full ? document.exitFullscreen() : box.current?.requestFullscreen())}
            className="rounded-lg border border-border bg-panel px-3 py-1.5 font-medium hover:bg-panel-2"
          >
            {full ? "Exit fullscreen" : "⛶ Fullscreen"}
          </button>
          <Link href="/" className="text-muted hover:text-foreground">
            ← Markets
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1 rounded-xl border border-border bg-panel p-4">
        <PriceChart key={symbol} symbol={symbol} onLast={onLast} className="h-[calc(100dvh-260px)] min-h-72 [:fullscreen_&]:h-[calc(100dvh-200px)]" />
      </div>
    </div>
  );
}
