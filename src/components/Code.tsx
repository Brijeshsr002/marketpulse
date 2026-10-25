"use client";

import { useState, useSyncExternalStore } from "react";

const noop = () => () => {};

/** Code block that swaps {{BASE}} for this site's origin, so snippets are copy-paste ready on any deployment. */
export function Code({ code, lang }: { code: string; lang?: string }) {
  const origin = useSyncExternalStore(noop, () => window.location.origin, () => "https://your-site.vercel.app");
  const [copied, setCopied] = useState(false);
  const text = code.replaceAll("{{BASE}}", origin).trim();
  return (
    <div className="group relative my-3">
      {lang && <span className="absolute left-3 top-2 text-[10px] uppercase tracking-wider text-muted">{lang}</span>}
      <button
        onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        className="absolute right-2 top-2 rounded-md bg-panel-2 px-2 py-1 text-xs text-muted hover:text-foreground"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className={`overflow-x-auto rounded-lg border border-border bg-background p-4 text-[13px] leading-relaxed ${lang ? "pt-7" : ""}`}>
        <code>{text}</code>
      </pre>
    </div>
  );
}
