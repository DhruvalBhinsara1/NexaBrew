import Link from "next/link";

export default function HomePage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface-muted px-4 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-brand-700">
          NexaBrew
        </h1>
        <p className="text-muted-foreground">
          Cafe POS &amp; Management System
        </p>
      </div>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          Sign In
        </Link>
        <Link
          href="/kds"
          className="rounded-md border border-surface-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Kitchen Display
        </Link>
      </div>
    </main>
  );
}
