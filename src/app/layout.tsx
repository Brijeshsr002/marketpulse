import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarketPulse — live markets for humans and AI agents",
  description: "Live crypto, forex, US and India NSE prices with an MCP server and REST API so AI agents like Claude, n8n and Sendiee can read the market.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-sm text-white">M</span>
              MarketPulse
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <Link href="/" className="rounded-lg px-3 py-1.5 text-muted hover:text-foreground">Markets</Link>
              <Link href="/docs" className="rounded-lg px-3 py-1.5 text-muted hover:text-foreground">AI Docs</Link>
              <Link href="/docs#mcp" className="rounded-lg bg-accent px-3 py-1.5 font-medium text-white hover:opacity-90">Connect agent</Link>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
