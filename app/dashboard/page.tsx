import { getServerUser } from "@/lib/auth/getServerUser";
import { LogoutButton } from "@/components/shared/LogoutButton";

// Placeholder — replaced by the real admin dashboard in Phase 13.
export default async function DashboardPage(): Promise<React.ReactElement> {
  const user = await getServerUser();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-muted px-4 text-center">
      <h1 className="text-2xl font-semibold text-brand-700">Admin Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as {user.email} ({user.role})
      </p>
      <p className="text-sm text-muted-foreground">Coming in Phase 13.</p>
      <LogoutButton />
    </main>
  );
}
