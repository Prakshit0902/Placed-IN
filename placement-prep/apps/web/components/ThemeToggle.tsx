"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  if (!ready) return <div className="w-9 h-9" aria-hidden />;

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="relative w-9 h-9 rounded-full border border-border bg-surface/60 backdrop-blur-sm flex items-center justify-center cursor-pointer hover:border-foreground/30 transition-all duration-300 overflow-hidden"
    >
      <Sun
        className={`absolute h-[17px] w-[17px] text-foreground transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "rotate-90 scale-0 opacity-0"
        }`}
      />
      <Moon
        className={`absolute h-[17px] w-[17px] text-foreground transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isDark
            ? "-rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        }`}
      />
    </button>
  );
}
