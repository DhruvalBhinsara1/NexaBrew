// Public Kitchen Display (DECISION-009 — no auth). Placeholder; real 3-column
// kanban board arrives in Phase 15.
export default function KdsPage(): React.ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-kds-bg px-4 text-center text-white">
      <h1 className="text-2xl font-semibold">Kitchen Display</h1>
      <p className="text-white/60">Public, no login required.</p>
      <p className="text-sm text-white/40">Coming in Phase 15.</p>
    </main>
  );
}
