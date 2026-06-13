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
  ShoppingCart,
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
  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
  { label: "Sessions", href: "/dashboard/sessions", icon: Clock },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3 },
];

export function DashboardSidebar(): React.ReactElement {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-white/10 bg-wise-ink">
      {/* Brand */}
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-wise bg-wise-primary text-wise-ink">
          <Coffee className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <span className="block font-display text-base font-extrabold tracking-tight text-white">NexaBrew</span>
          <span className="block text-[11px] text-white/40">Management</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
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
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-wise px-3 py-2 text-sm font-medium transition-colors duration-150",
                    active
                      ? "bg-wise-primary text-wise-ink"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0 transition-colors", active ? "text-wise-ink" : "text-white/50 group-hover:text-wise-primary")} />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Operations
        </p>
        <ul className="space-y-1">
          <li>
            <Link
              href="/pos/terminal"
              className="group flex items-center gap-3 rounded-wise px-3 py-2 text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <ExternalLink className="h-4 w-4 shrink-0 text-white/50 transition-colors group-hover:text-wise-primary" />
              Open POS Terminal
            </Link>
          </li>
          <li>
            <a
              href="/kds"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-wise px-3 py-2 text-sm font-medium text-white/70 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <ChefHat className="h-4 w-4 shrink-0 text-white/50 transition-colors group-hover:text-wise-primary" />
              Kitchen Display
            </a>
          </li>
        </ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-3">
        <LogoutButton />
      </div>
    </aside>
  );
}
