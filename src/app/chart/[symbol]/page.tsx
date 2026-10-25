import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BigChart } from "@/components/BigChart";
import { findSymbol, SYMBOLS } from "@/lib/symbols";

export function generateStaticParams() {
  return SYMBOLS.map((s) => ({ symbol: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/chart/[symbol]">): Promise<Metadata> {
  const s = findSymbol((await params).symbol);
  return { title: s ? `${s.id} live chart — MarketPulse` : "Chart — MarketPulse" };
}

export default async function ChartPage({ params }: PageProps<"/chart/[symbol]">) {
  const s = findSymbol((await params).symbol);
  if (!s) notFound();
  return <BigChart symbol={s.id} />;
}
