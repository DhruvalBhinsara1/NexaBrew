import Link from "next/link";
import { Coffee } from "lucide-react";

export default function HomePage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-wise-canvas-soft px-4 text-center">
      <div className="space-y-3">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-wiseCard bg-wise-primary text-wise-ink">
          <Coffee className="h-7 w-7" />
        </span>
        <h1 className="font-display text-5xl font-extrabold tracking-tight text-wise-ink">
          NexaBrew
        </h1>
        <p className="text-wise-body">
          Cafe POS &amp; Management System
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/login"
          className="rounded-wiseCard bg-wise-primary px-6 py-3 text-sm font-semibold text-wise-ink transition-colors duration-150 hover:bg-wise-primary-active"
        >
          Sign In
        </Link>
        <Link
          href="/kds"
          className="rounded-wiseCard border border-wise-ink bg-wise-canvas px-6 py-3 text-sm font-semibold text-wise-ink transition-colors duration-150 hover:bg-wise-canvas-soft"
        >
          Kitchen Display
        </Link>
      </div>
    </main>
  );
}
