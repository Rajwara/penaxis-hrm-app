export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-400/15 text-amber-600 ring-1 ring-amber-400/30",
    approved: "bg-success/10 text-success ring-1 ring-success/30",
    rejected: "bg-danger/10 text-danger ring-1 ring-danger/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${
        styles[status] || "bg-ink-100 text-ink-600"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
