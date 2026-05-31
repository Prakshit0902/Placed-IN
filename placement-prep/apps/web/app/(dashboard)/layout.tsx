"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FileText,
  Search,
  BarChart3,
  Settings,
  Sparkles,
  CreditCard,
} from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sheets/new", label: "New Sheet", icon: FileText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/settings/profile", label: "Settings", icon: Settings },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border/50 bg-surface/50 p-4">
        <Link href="/" className="flex items-center gap-2 px-3 mb-8">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">PrepAssist</span>
        </Link>

        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/10 text-primary-light border border-primary/20"
                    : "text-muted hover:text-foreground hover:bg-surface-elevated"
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-border/30">
          <div className="flex items-center gap-3 px-3">
            <UserButton
              appearance={{
                elements: { avatarBox: "h-8 w-8" },
              }}
            />
            <span className="text-sm text-muted">Account</span>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-col flex-1">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-surface/50">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-bold">PrepAssist</span>
          </Link>
          <UserButton />
        </header>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around bg-surface border-t border-border/50 py-2 z-50">
          {navItems.slice(0, 4).map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex flex-col items-center gap-0.5 text-xs p-1 transition",
                  isActive ? "text-primary-light" : "text-muted"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 md:p-8 pb-20 md:pb-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
