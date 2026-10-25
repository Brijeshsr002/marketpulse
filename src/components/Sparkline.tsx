export function Sparkline({ data, up, className = "" }: { data: number[]; up: boolean; className?: string }) {
  if (data.length < 2) return <div className={className} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={points} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
