"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  FileText,
  Search,
  BarChart2,
  Settings,
  Sparkles,
  Zap,
  CreditCard,
  Terminal,
} from "lucide-react";
import clsx from "clsx";
import React from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard#sheets", label: "My Sheets", icon: FileText },
  { href: "/search", label: "Search", icon: Search },
  { href: "/progress", label: "Progress", icon: BarChart2 },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles, badge: "Beta" },
  { href: "/sprints", label: "Sprints", icon: Zap },
  { href: "/settings/profile", label: "Settings", icon: Settings },
  { href: "/settings/billing", label: "Billing", icon: CreditCard },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useUser();
  const username = user?.fullName || user?.username || "Guest";

  // Magnetic button handlers
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    el.style.setProperty("--bx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--by", `${e.clientY - rect.top}px`);
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translate(0, 0)";
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground font-sans">
      {/* LEFT SIDEBAR (260px, fixed, full height) */}
      <aside className="w-[260px] h-screen sticky top-0 border-r border-border bg-background/50 flex flex-col p-5 shrink-0 relative overflow-hidden justify-between">
        {/* Low opacity grid background */}
        <div className="absolute inset-0 grid-bg opacity-[0.03] pointer-events-none" />

        <div className="flex flex-col gap-6 relative z-10">
          {/* Logo Section */}
          <Link href="/" className="flex items-center gap-2.5 px-2 py-1.5 group">
            <Terminal className="h-5 w-5 text-foreground opacity-80 group-hover:opacity-100 transition-opacity" />
            <span className="text-[15px] font-light tracking-wide text-foreground">
              Prep<span className="font-semibold">Assist</span>
            </span>
          </Link>

          {/* User Section */}
          <div className="flex items-center justify-between px-2 py-3 border-y border-border/40 bg-surface/10 rounded-xl">
            <div className="flex items-center gap-3 min-w-0">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8 rounded-lg border border-border",
                  },
                }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate text-foreground leading-none mb-1">
                  {username}
                </span>
                <span className="text-[10px] text-success font-medium flex items-center gap-1 leading-none">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse inline-block" />
                  Active
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1 mt-2">
            {navItems.map((item) => {
              const isAiOrSprint = item.href === "/assistant" || item.href === "/sprints";
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" &&
                  !isAiOrSprint &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  key={item.label}
                  href={isAiOrSprint ? "#" : item.href}
                  className={clsx(
                    "flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                    isActive
                      ? "bg-surface-elevated text-foreground border-l-2 border-foreground font-semibold"
                      : "text-muted hover:text-foreground hover:bg-surface-elevated/40 hover:translate-x-1"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={clsx(
                        "h-4.5 w-4.5 transition-transform duration-200 group-hover:-rotate-[5deg]",
                        isActive ? "text-foreground" : "text-muted group-hover:text-foreground"
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[9px] px-1.5 py-0.5 font-bold uppercase tracking-wider bg-primary/10 text-primary-light border border-primary/20 rounded-md">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar: Upgrade to Pro card */}
        <div className="relative z-10 mt-auto pt-4 border-t border-border/30">
          <div className="glass-card p-4 relative overflow-hidden group">
            <div className="reflection-sweep absolute inset-0 opacity-40 group-hover:animate-[sweep_2.5s_linear_infinite]" />
            <div className="relative z-10">
              <h4 className="text-[13px] font-semibold tracking-wide text-foreground">Upgrade to Pro</h4>
              <p className="text-[11px] text-muted mt-1 mb-3">
                Unlock custom sheet generation, premium analytics & SDE-2 study plans.
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] uppercase font-mono tracking-widest text-muted">Free Plan</span>
                <button
                  onMouseMove={handleMagneticMove}
                  onMouseLeave={handleMagneticLeave}
                  className="magnetic-btn text-[11px] px-3.5 py-1.5 bg-foreground text-background font-medium rounded-full hover:opacity-90 transition-opacity cursor-pointer shrink-0"
                >
                  Upgrade
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
