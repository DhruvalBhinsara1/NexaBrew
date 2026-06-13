"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Preline UI needs its interactive plugins (dropdowns, overlays, tabs, etc.)
 * re-initialized after every client-side navigation in the Next.js App Router.
 * This component loads Preline once and calls autoInit on each route change.
 */
export function PrelineScript(): null {
  const pathname = usePathname();

  useEffect(() => {
    const init = async (): Promise<void> => {
      await import("preline/preline");
      // HSStaticMethods is attached to window by the import above.
      const w = window as unknown as {
        HSStaticMethods?: { autoInit: () => void };
      };
      // Defer to next tick so the new route's DOM is committed first.
      setTimeout(() => w.HSStaticMethods?.autoInit(), 100);
    };
    void init();
  }, [pathname]);

  return null;
}
