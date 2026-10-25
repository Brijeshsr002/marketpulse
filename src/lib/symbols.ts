export type Market = "crypto" | "forex" | "us" | "nse";

export type SymbolInfo = {
  /** Public id used by the site, REST API and MCP tools, e.g. "BTC", "AAPL", "RELIANCE". */
  id: string;
  name: string;
  market: Market;
  /** Yahoo Finance ticker (forex, US, NSE). */
  yahoo?: string;
  /** Binance spot pair (crypto). */
  binance?: string;
};

export const MARKETS: { id: Market; label: string }[] = [
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "us", label: "US Stocks" },
  { id: "nse", label: "India (NSE)" },
];

export const SYMBOLS: SymbolInfo[] = [
  { id: "BTC", name: "Bitcoin", market: "crypto", binance: "BTCUSDT" },
  { id: "ETH", name: "Ethereum", market: "crypto", binance: "ETHUSDT" },
  { id: "SOL", name: "Solana", market: "crypto", binance: "SOLUSDT" },
  { id: "BNB", name: "BNB", market: "crypto", binance: "BNBUSDT" },
  { id: "XRP", name: "XRP", market: "crypto", binance: "XRPUSDT" },
  { id: "DOGE", name: "Dogecoin", market: "crypto", binance: "DOGEUSDT" },

  { id: "EURUSD", name: "Euro / US Dollar", market: "forex", yahoo: "EURUSD=X" },
  { id: "GBPUSD", name: "British Pound / US Dollar", market: "forex", yahoo: "GBPUSD=X" },
  { id: "USDJPY", name: "US Dollar / Japanese Yen", market: "forex", yahoo: "USDJPY=X" },
  { id: "USDINR", name: "US Dollar / Indian Rupee", market: "forex", yahoo: "USDINR=X" },
  { id: "AUDUSD", name: "Australian Dollar / US Dollar", market: "forex", yahoo: "AUDUSD=X" },
  { id: "GOLD", name: "Gold Futures", market: "forex", yahoo: "GC=F" },

  { id: "SPX", name: "S&P 500", market: "us", yahoo: "^GSPC" },
  { id: "NDX", name: "Nasdaq Composite", market: "us", yahoo: "^IXIC" },
  { id: "AAPL", name: "Apple", market: "us", yahoo: "AAPL" },
  { id: "MSFT", name: "Microsoft", market: "us", yahoo: "MSFT" },
  { id: "NVDA", name: "NVIDIA", market: "us", yahoo: "NVDA" },
  { id: "TSLA", name: "Tesla", market: "us", yahoo: "TSLA" },
  { id: "AMZN", name: "Amazon", market: "us", yahoo: "AMZN" },
  { id: "GOOGL", name: "Alphabet", market: "us", yahoo: "GOOGL" },

  { id: "NIFTY", name: "Nifty 50", market: "nse", yahoo: "^NSEI" },
  { id: "BANKNIFTY", name: "Nifty Bank", market: "nse", yahoo: "^NSEBANK" },
  { id: "RELIANCE", name: "Reliance Industries", market: "nse", yahoo: "RELIANCE.NS" },
  { id: "TCS", name: "Tata Consultancy Services", market: "nse", yahoo: "TCS.NS" },
  { id: "HDFCBANK", name: "HDFC Bank", market: "nse", yahoo: "HDFCBANK.NS" },
  { id: "INFY", name: "Infosys", market: "nse", yahoo: "INFY.NS" },
  { id: "ICICIBANK", name: "ICICI Bank", market: "nse", yahoo: "ICICIBANK.NS" },
  { id: "SBIN", name: "State Bank of India", market: "nse", yahoo: "SBIN.NS" },
];

const BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]));

export function findSymbol(id: string): SymbolInfo | undefined {
  return BY_ID.get(id.trim().toUpperCase());
}

export function isMarket(value: unknown): value is Market {
  return MARKETS.some((m) => m.id === value);
}
