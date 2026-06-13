import { Coffee } from "lucide-react";

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.ReactElement {
  return (
    <div className="flex min-h-screen bg-surface-muted">
      {/* Brand panel (hidden on mobile) */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <Coffee className="h-7 w-7" />
          <span className="text-xl font-bold tracking-tight">NexaBrew</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold leading-tight">
            Run your cafe, end to end.
          </h1>
          <p className="mt-4 text-base text-white/80">
            Orders, kitchen display, payments, and reporting — one fast,
            real-time system for admins, staff, and customers.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {["Real-time kitchen display", "Razorpay & cash payments", "Live sales reporting"].map(
              (f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                    ✓
                  </span>
                  {f}
                </li>
              )
            )}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/50">
          © NexaBrew — Cafe POS &amp; Management
        </p>

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
