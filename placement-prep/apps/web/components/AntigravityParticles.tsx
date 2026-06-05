"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";

interface Dot {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  o: number;
}

export default function AntigravityParticles() {
  const { theme } = useTheme();
  const cvs = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const c = cvs.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const COUNT = 45;
    const dots: Dot[] = [];

    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (startY?: number): Dot => ({
      x: Math.random() * c.width,
      y: startY ?? c.height + Math.random() * 40,
      r: Math.random() * 1.4 + 0.3,
      vy: -(Math.random() * 0.3 + 0.06),
      vx: (Math.random() - 0.5) * 0.1,
      o: Math.random() * 0.4 + 0.08,
    });

    for (let i = 0; i < COUNT; i++) dots.push(spawn(-Math.random() * c.height));

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);

    const rgb = theme === "dark" ? "250,250,250" : "9,9,11";

    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      dots.forEach((d, i) => {
        d.y += d.vy;
        d.x += d.vx;

        // Scatter from cursor
        const dx = d.x - mouse.current.x;
        const dy = d.y - mouse.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 130) {
          const force = (130 - dist) / 130;
          d.x += (dx / dist) * force * 0.8;
          d.y += (dy / dist) * force * 0.35;
        }

        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb},${d.o})`;
        ctx.fill();

        // Recycle when off-screen
        if (d.y < -10 || d.x < -10 || d.x > c.width + 10) {
          dots[i] = spawn();
        }
      });
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [theme]);

  return (
    <canvas
      ref={cvs}
      className="fixed inset-0 pointer-events-none z-[1] opacity-40"
      aria-hidden="true"
    />
  );
}
