"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Clock,
  CreditCard,
  ExternalLink,
  LayoutDashboard,
  LayoutGrid,
  Package,
  Tag,
  Ticket,
  Users,
  ChefHat,
  Coffee,
  Contact,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoutButton } from "@/components/shared/LogoutButton";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Products", href: "/dashboard/products", icon: Package },
  { label: "Categories", href: "/dashboard/categories", icon: Tag },
  { label: "Floors & Tables", href: "/dashboard/floors", icon: LayoutGrid },
  { label: "Payment Methods", href: "/dashboard/payment-methods", icon: CreditCard },
  { label: "Coupons & Promos", href: "/dashboard/coupons", icon: Ticket },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Customers", href: "/pos/customers", icon: Contact },
  { label: "Sessions", href: "/dashboard/sessions", icon: Clock },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];

export function DashboardSidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-surface-border bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-surface-border px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Coffee className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <span className="block text-sm font-bold text-zinc-900">NexaBrew</span>
          <span className="block text-[11px] text-zinc-400">Management</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Manage
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ label, href, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-500 text-white shadow-sm"
                      : "text-zinc-600 hover:bg-brand-50 hover:text-brand-700"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", active ? "text-white" : "text-zinc-400 group-hover:text-brand-600")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Operations
        </p>
        <ul className="space-y-1">
          <li>
            <Link
              href="/pos/terminal"
              className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-brand-600" />
              Open POS Terminal
            </Link>
          </li>
          <li>
            <a
              href="/kds"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-brand-50 hover:text-brand-700"
            >
              <ChefHat className="h-4 w-4 shrink-0 text-zinc-400 group-hover:text-brand-600" />
              Kitchen Display
            </a>
          </li>
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-surface-border p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
