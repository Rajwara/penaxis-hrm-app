export function VerifiedBadge({ title = "Permanent employee" }: { title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline-block h-4 w-4 shrink-0 align-text-bottom"
      aria-label={title}
    >
      <title>{title}</title>
      <circle cx="12" cy="12" r="10" fill="#2B7FFF" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
