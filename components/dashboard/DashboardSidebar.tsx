"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock,
  CreditCard,
  ExternalLink,
  LayoutGrid,
  Package,
  Tag,
  Ticket,
  Users,
  ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/shared/LogoutButton";

const NAV_ITEMS = [
  { label: "Products", href: "/dashboard/products", icon: Package },
  { label: "Categories", href: "/dashboard/categories", icon: Tag },
  { label: "Floors & Tables", href: "/dashboard/floors", icon: LayoutGrid },
  { label: "Payment Methods", href: "/dashboard/payment-methods", icon: CreditCard },
  { label: "Coupons & Promos", href: "/dashboard/coupons", icon: Ticket },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Sessions", href: "/dashboard/sessions", icon: Clock },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];

export function DashboardSidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-surface-border bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-surface-border px-4 py-5">
        <span className="text-lg font-bold text-brand-600">NexaBrew</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-l-2 border-brand-500 bg-brand-50 text-brand-700"
                      : "text-zinc-600 hover:bg-surface-muted hover:text-zinc-900"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="my-3 border-t border-surface-border" />

        <Link
          href="/pos/terminal"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-surface-muted hover:text-zinc-900"
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          Open POS Terminal
        </Link>

        <a
          href="/kds"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-surface-muted hover:text-zinc-900"
        >
          <ChefHat className="h-4 w-4 shrink-0" />
          Kitchen Display
        </a>
      </nav>

      {/* Logout */}
      <div className="border-t border-surface-border p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
