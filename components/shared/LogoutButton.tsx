"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LogoutButton(): React.ReactElement {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout(): Promise<void> {
    setBusy(true);
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={busy}
      className="w-full justify-start rounded-wise border border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
    >
      <LogOut className="mr-2 h-4 w-4" />
      {busy ? "Signing out..." : "Logout"}
    </Button>
  );
}
