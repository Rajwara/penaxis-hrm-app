import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-ink-800 p-2">
          <Image
            src="/penaxis-icon.png"
            alt="Penaxis"
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
        </div>

        <p className="font-mono text-sm font-semibold uppercase tracking-widest text-brand-500">
          Error 404
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink-900">
          This page clocked out early
        </h1>
        <p className="mt-3 text-sm text-ink-400">
          We couldn't find the page you were looking for. It may have been moved,
          renamed, or never existed in the first place.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/" className="btn-primary w-full sm:w-auto">
            Back to Penaxis HR
          </Link>
          <Link href="/login" className="btn-secondary w-full sm:w-auto">
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
