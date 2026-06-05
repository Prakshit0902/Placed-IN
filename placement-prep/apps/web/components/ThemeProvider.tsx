"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  /* ── Read stored / system preference on mount ── */
  useEffect(() => {
    const stored = localStorage.getItem("pa-theme") as Theme | null;
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
    } else {
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light",
      );
    }
    setMounted(true);
  }, []);

  /* ── Sync class + storage on change ── */
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pa-theme", theme);
  }, [theme, mounted]);

  const toggleTheme = useCallback(
    () => setTheme((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );

  const active = mounted ? theme : "dark";

  /* ── Dynamic Clerk appearance per theme ── */
  const clerkAppearance =
    active === "dark"
      ? {
          baseTheme: dark,
          variables: {
            colorPrimary: "#fafafa",
            colorBackground: "#09090b",
            colorForeground: "#fafafa",
            colorInputForeground: "#fafafa",
            colorInput: "#18181b",
            colorTextSecondary: "#a1a1aa",
            colorText: "#fafafa",
            colorBorder: "#27272a",
          },
        }
      : {
          variables: {
            colorPrimary: "#18181b",
            colorBackground: "#ffffff",
            colorForeground: "#09090b",
            colorInputForeground: "#09090b",
            colorInput: "#f4f4f5",
            colorTextSecondary: "#71717a",
            colorText: "#09090b",
            colorBorder: "#e4e4e7",
          },
        };

  return (
    <ThemeContext.Provider value={{ theme: active, toggleTheme }}>
      <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
