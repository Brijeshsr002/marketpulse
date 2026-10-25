import "server-only";
import { findSymbol, SYMBOLS, type Market, type SymbolInfo } from "./symbols";

// Free, keyless public endpoints. data-api.binance.vision is Binance's market-data-only
// mirror and works from regions where api.binance.com is geo-blocked (e.g. US Vercel).
const BINANCE = "https://data-api.binance.vision/api/v3";
const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; MarketPulse/1.0)" };

export type Quote = {
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
  /** ISO timestamp of the last trade/tick. */
  time: string;
  /** Recent intraday closes, oldest first, for sparklines. */
  spark: number[];
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

export const RANGES = ["1d", "5d", "1mo", "6mo", "1y"] as const;
export type Range = (typeof RANGES)[number];

const YAHOO_INTERVAL: Record<Range, string> = { "1d": "5m", "5d": "30m", "1mo": "1d", "6mo": "1d", "1y": "1d" };
const BINANCE_INTERVAL: Record<Range, [string, number]> = {
  "1d": ["5m", 288],
  "5d": ["30m", 240],
  "1mo": ["4h", 180],
  "6mo": ["1d", 182],
  "1y": ["1d", 365],
};

export function isRange(value: unknown): value is Range {
  return RANGES.includes(value as Range);
}

/** Bar sizes for candlestick charts. Each returns up to MAX_BARS of the most recent candles. */
export const INTERVALS = ["1m", "5m", "15m", "1h", "1d"] as const;
export type Interval = (typeof INTERVALS)[number];
const MAX_BARS = 240;
// Yahoo needs a lookback range long enough to fill MAX_BARS; Binance takes the bar size directly.
const YAHOO_LOOKBACK: Record<Interval, [range: string, interval: string]> = {
  "1m": ["1d", "1m"],
  "5m": ["5d", "5m"],
  "15m": ["5d", "15m"],
  "1h": ["1mo", "60m"],
  "1d": ["1y", "1d"],
};

export function isInterval(value: unknown): value is Interval {
  return INTERVALS.includes(value as Interval);
}

// Small in-memory TTL cache so bursts of dashboard/agent calls don't hammer upstream APIs.
const cache = new Map<string, { exp: number; value: Promise<unknown> }>();

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { exp: Date.now() + ttlMs, value });
  value.catch(() => cache.delete(key));
  return value;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  if (!res.ok) throw new Error(`Upstream ${res.status} for ${new URL(url).host}`);
  return (await res.json()) as T;
}

type YahooChart = {
  chart: {
    result:
      | {
          meta: {
            regularMarketPrice: number;
            chartPreviousClose?: number;
            previousClose?: number;
            currency?: string;
            regularMarketTime?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketVolume?: number;
          };
          timestamp?: number[];
          indicators: {
            quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }[];
          };
        }[]
      | null;
    error: { description: string } | null;
  };
};

async function yahooChart(ticker: string, range: string, interval: string) {
  const url = `${YAHOO}/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  const data = await getJson<YahooChart>(url);
  const result = data.chart.result?.[0];
  if (!result) throw new Error(data.chart.error?.description ?? `No data for ${ticker}`);
  return result;
}

function yahooCandles(result: Awaited<ReturnType<typeof yahooChart>>): Candle[] {
  const q = result.indicators.quote[0];
  const out: Candle[] = [];
  (result.timestamp ?? []).forEach((t, i) => {
    const close = q?.close[i];
    if (close == null) return;
    out.push({
      time: t,
      open: q.open[i] ?? close,
      high: q.high[i] ?? close,
      low: q.low[i] ?? close,
      close,
      volume: q.volume[i] ?? 0,
    });
  });
  return out;
}

type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  prevClosePrice: string;
  highPrice: string;
  lowPrice: string;
  quoteVolume: string;
  closeTime: number;
};
type BinanceKline = [number, string, string, string, string, string, ...unknown[]];

async function binanceCandles(pair: string, interval: string, limit: number): Promise<Candle[]> {
  const rows = await getJson<BinanceKline[]>(`${BINANCE}/klines?symbol=${pair}&interval=${interval}&limit=${limit}`);
  return rows.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: +k[1],
    high: +k[2],
    low: +k[3],
    close: +k[4],
    volume: +k[5],
  }));
}

async function cryptoQuotes(symbols: SymbolInfo[]): Promise<Quote[]> {
  if (!symbols.length) return [];
  const pairs = JSON.stringify(symbols.map((s) => s.binance));
  const tickers = await getJson<BinanceTicker[]>(`${BINANCE}/ticker/24hr?symbols=${encodeURIComponent(pairs)}`);
  const byPair = new Map(tickers.map((t) => [t.symbol, t]));
  return Promise.all(
    symbols.map(async (s) => {
      const t = byPair.get(s.binance!);
      if (!t) throw new Error(`No ticker for ${s.id}`);
      const spark = await getCandles(s.id, "1d").then(
        (c) => c.filter((_, i) => i % 6 === 0).map((x) => x.close),
        () => [],
      );
      return {
        id: s.id,
        name: s.name,
        market: s.market,
        price: +t.lastPrice,
        change: +t.priceChange,
        changePercent: +t.priceChangePercent,
        previousClose: +t.prevClosePrice,
        dayHigh: +t.highPrice,
        dayLow: +t.lowPrice,
        volume: +t.quoteVolume,
        currency: "USDT",
        time: new Date(t.closeTime).toISOString(),
        spark,
      };
    }),
  );
}

async function yahooQuote(s: SymbolInfo): Promise<Quote> {
  const result = await yahooChart(s.yahoo!, "1d", YAHOO_INTERVAL["1d"]);
  const m = result.meta;
  const prev = m.chartPreviousClose ?? m.previousClose ?? m.regularMarketPrice;
  const change = m.regularMarketPrice - prev;
  const candles = yahooCandles(result);
  return {
    id: s.id,
    name: s.name,
    market: s.market,
    price: m.regularMarketPrice,
    change,
    changePercent: prev ? (change / prev) * 100 : 0,
    previousClose: prev,
    dayHigh: m.regularMarketDayHigh ?? null,
    dayLow: m.regularMarketDayLow ?? null,
    volume: m.regularMarketVolume ?? null,
    currency: m.currency ?? "",
    time: new Date((m.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    spark: candles.filter((_, i) => i % 3 === 0).map((c) => c.close),
  };
}

export type QuotesResult = { quotes: Quote[]; errors: { id: string; error: string }[] };

/** Quotes for the given symbol ids (or a whole market). Unknown ids are reported in `errors`. */
export async function getQuotes(opts: { ids?: string[]; market?: Market }): Promise<QuotesResult> {
  const errors: QuotesResult["errors"] = [];
  let symbols: SymbolInfo[];
  if (opts.ids?.length) {
    symbols = [];
    for (const id of opts.ids) {
      const s = findSymbol(id);
      if (s) symbols.push(s);
      else errors.push({ id, error: "Unknown symbol. Call list_symbols / GET /api/v1/symbols." });
    }
  } else {
    symbols = SYMBOLS.filter((s) => !opts.market || s.market === opts.market);
  }

  const crypto = symbols.filter((s) => s.binance);
  const others = symbols.filter((s) => s.yahoo);
  const settled = await Promise.allSettled([
    cached(`q:crypto:${crypto.map((s) => s.id).join(",")}`, 5_000, () => cryptoQuotes(crypto)),
    ...others.map((s) => cached(`q:${s.id}`, 5_000, () => yahooQuote(s)).then((q) => [q])),
  ]);

  const quotes: Quote[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") quotes.push(...r.value);
    else {
      const failed = i === 0 ? crypto : [others[i - 1]];
      for (const s of failed) errors.push({ id: s.id, error: String(r.reason?.message ?? r.reason) });
    }
  });
  const order = new Map(symbols.map((s, i) => [s.id, i]));
  quotes.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  return { quotes, errors };
}

export async function getCandles(id: string, range: Range): Promise<Candle[]> {
  const s = findSymbol(id);
  if (!s) throw new Error(`Unknown symbol "${id}"`);
  return cached(`c:${s.id}:${range}`, 30_000, async () =>
    s.binance
      ? binanceCandles(s.binance, ...BINANCE_INTERVAL[range])
      : yahooCandles(await yahooChart(s.yahoo!, range, YAHOO_INTERVAL[range])),
  );
}

/** The most recent candles of a fixed bar size, e.g. 1-minute candles for a live chart. */
export async function getCandlesByInterval(id: string, interval: Interval): Promise<Candle[]> {
  const s = findSymbol(id);
  if (!s) throw new Error(`Unknown symbol "${id}"`);
  return cached(`ci:${s.id}:${interval}`, interval === "1m" ? 10_000 : 30_000, async () => {
    if (s.binance) return binanceCandles(s.binance, interval, MAX_BARS);
    const [range, yahooInterval] = YAHOO_LOOKBACK[interval];
    return yahooCandles(await yahooChart(s.yahoo!, range, yahooInterval)).slice(-MAX_BARS);
  });
}

/** Per-market snapshot: every quote plus top gainers/losers. */
export async function getOverview() {
  const { quotes, errors } = await getQuotes({});
  const byChange = [...quotes].sort((a, b) => b.changePercent - a.changePercent);
  // Sparklines are UI-only; drop them from the agent-facing snapshot.
  const slim = (q: Quote) => ({ ...q, spark: undefined });
  return {
    asOf: new Date().toISOString(),
    gainers: byChange.slice(0, 5).map(slim),
    losers: byChange.slice(-5).reverse().map(slim),
    markets: (["crypto", "forex", "us", "nse"] as const).map((market) => ({
      market,
      quotes: quotes.filter((q) => q.market === market).map(slim),
    })),
    errors,
  };
}
