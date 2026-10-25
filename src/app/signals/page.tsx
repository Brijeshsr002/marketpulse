import type { Metadata } from "next";
import { SignalTracker } from "@/components/SignalTracker";

export const metadata: Metadata = {
  title: "Signal Tracker — MarketPulse",
  description: "Test an experimental next-candle rule against real 1-minute candles and measure its true win rate.",
};

export default function SignalsPage() {
  return <SignalTracker />;
}
