"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import {
  Terminal,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Circle,
  Sparkles,
  MessageSquare,
  RefreshCw,
  Gauge,
  Cpu,
  Search,
  Calendar,
  CreditCard
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import AntigravityParticles from "@/components/AntigravityParticles";
import ParallaxCard from "@/components/ParallaxCard";
import { useTheme } from "@/components/ThemeProvider";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ─── STAGGERED CHARACTER TEXT SPLITTER FOR HERO ENTRANCE ───
function SplitText({ text, delayOffset = 0 }: { text: string; delayOffset?: number }) {
  let globalCharIndex = 0;
  return (
    <>
      {text.split(" ").map((word, wIdx) => {
        const wordChars = word.split("");
        return (
          <span key={wIdx} className="inline-block whitespace-nowrap">
            {wordChars.map((char, cIdx) => {
              const delay = delayOffset + globalCharIndex * 20;
              globalCharIndex++;
              return (
                <span
                  key={cIdx}
                  className="inline-block translate-y-2 opacity-0 animate-fade-in text-foreground"
                  style={{
                    animationDelay: `${delay}ms`,
                    animationFillMode: "forwards",
                  }}
                >
                  {char}
                </span>
              );
            })}
            {wIdx < text.split(" ").length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        );
      })}
    </>
  );
}

// ─── CUSTOM CURSOR DOT & LERP RING ───
function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (prefersReducedMotion || isTouch) return;

    let mouseX = 0, mouseY = 0;
    let ringX = 0, ringY = 0;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
      }
    };

    window.addEventListener("mousemove", onMove);

    const lerpRing = () => {
      ringX += (mouseX - ringX) * 0.15;
      ringY += (mouseY - ringY) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      }
      requestAnimationFrame(lerpRing);
    };
    const rafId = requestAnimationFrame(lerpRing);

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, input, select, textarea, [role='button']")) {
        document.body.classList.add("custom-cursor-hovering");
      } else {
        document.body.classList.remove("custom-cursor-hovering");
      }
    };
    window.addEventListener("mouseover", onOver);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      cancelAnimationFrame(rafId);
      document.body.classList.remove("custom-cursor-hovering");
    };
  }, []);

  return (
    <>
      <div ref={dotRef} className="custom-cursor-dot pointer-events-none fixed" />
      <div ref={ringRef} className="custom-cursor-ring pointer-events-none fixed" />
    </>
  );
}

// ─── VERTICAL SCROLL PROGRESS INDICATOR ───
function SectionProgressIndicator() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      if (barRef.current) {
        barRef.current.style.transform = `scaleY(${scrollPercent})`;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-0.5 bg-border/20 z-50 origin-top">
      <div ref={barRef} className="w-full h-full bg-foreground origin-top scale-y-0 will-change-transform" />
    </div>
  );
}

// ─── MAIN LANDING PAGE COMPONENT ───
export default function LandingPage() {
  const { theme } = useTheme();
  
  const pageRef = useRef<HTMLDivElement>(null);
  const bentoSectionRef = useRef<HTMLDivElement>(null);
  const syncSectionRef = useRef<HTMLDivElement>(null);
  const readinessSectionRef = useRef<HTMLDivElement>(null);
  const assistantSectionRef = useRef<HTMLDivElement>(null);
  const semanticSectionRef = useRef<HTMLDivElement>(null);
  const sprintSectionRef = useRef<HTMLDivElement>(null);
  const pricingSectionRef = useRef<HTMLDivElement>(null);
  const faqSectionRef = useRef<HTMLDivElement>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [activeExplainTab, setActiveExplainTab] = useState<"analogy" | "dryrun" | "hints" | "complexity">("analogy");
  const [syncCount, setSyncCount] = useState(0);
  const [syncComplete, setSyncComplete] = useState(false);
  const [activeSprintDuration, setActiveSprintDuration] = useState<15 | 30 | 60>(30);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");

  const syncProgressRef = useRef(0);

  // Sync heatmap drawing helper
  const drawGrid = (progress: number, currentTheme: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cols = 52;
    const rows = 7;
    const cellSize = 10;
    const gap = 3;

    const dpr = window.devicePixelRatio || 1;
    const width = cols * (cellSize + gap) - gap;
    const height = rows * (cellSize + gap) - gap;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const isDark = currentTheme === "dark";
    const baseColor = isDark ? "#1c1c1e" : "#e4e4e7";
    
    // Monochromatic shades of Zinc
    const activeShades = isDark 
      ? ["#27272a", "#3f3f46", "#71717a", "#a1a1aa", "#d4d4d8", "#e4e4e7", "#fafafa"]
      : ["#e4e4e7", "#d4d4d8", "#a1a1aa", "#71717a", "#3f3f46", "#27272a", "#09090b"];

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = c * (cellSize + gap);
        const y = r * (cellSize + gap);

        // Diagonal wave activation: row + column determines threshold
        const threshold = (c / cols + r / rows) / 2;
        const isActivated = progress > threshold;

        if (isActivated) {
          const shadeIndex = Math.floor(((c * 7 + r) % activeShades.length));
          ctx.fillStyle = activeShades[shadeIndex];
        } else {
          ctx.fillStyle = baseColor;
        }
        
        ctx.beginPath();
        ctx.roundRect(x, y, cellSize, cellSize, 1.5);
        ctx.fill();
      }
    }
  };

  // Redraw sync canvas on theme change
  useEffect(() => {
    drawGrid(syncProgressRef.current, theme);
  }, [theme]);

  // Magnetic buttons
  const handleMagneticMove = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;

    el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
    el.style.setProperty("--bx", `${(e.clientX - rect.left)}px`);
    el.style.setProperty("--by", `${(e.clientY - rect.top)}px`);
  };

  const handleMagneticLeave = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    const el = e.currentTarget;
    el.style.transform = "translate(0, 0)";
  };

  // Sprint timelines
  const sprintSchedules = {
    15: [
      { week: "Phase 1 (Days 1-5)", topic: "Arrays, Binary Search & Sliding Window", count: 12 },
      { week: "Phase 2 (Days 6-10)", topic: "Trees, Graphs & DFS/BFS Traversal", count: 15 },
      { week: "Phase 3 (Days 11-15)", topic: "High-Frequency DP & Mock Sprint", count: 8 }
    ],
    30: [
      { week: "Week 1 (Days 1-7)", topic: "Arrays, Hashing & String Manipulation", count: 18 },
      { week: "Week 2 (Days 8-14)", topic: "Linked Lists, Stacks & Queues & Recursion", count: 14 },
      { week: "Week 3 (Days 15-21)", topic: "Trees, Binary Search Trees & Heaps", count: 20 },
      { week: "Week 4 (Days 22-30)", topic: "Dynamic Programming, Graphs & Advanced Backtracking", count: 22 }
    ],
    60: [
      { week: "Week 1-2 (Days 1-14)", topic: "Foundational Math, Arrays & Hashing Tricks", count: 28 },
      { week: "Week 3-4 (Days 15-28)", topic: "Advanced Linear Structures & Search Optimization", count: 24 },
      { week: "Week 5-6 (Days 29-42)", topic: "Trees, Graphs, Topological Sort & Disjoint Set Union", count: 32 },
      { week: "Week 7-8 (Days 43-60)", topic: "Dynamic Programming Patterns, Bitmasking & System Design", count: 36 }
    ]
  };

  // GSAP animations Orchestration
  useGSAP(() => {
    // 1. MacBook Bento Preview (sticky pin Zoom & screen bloom)
    gsap.timeline({
      scrollTrigger: {
        trigger: bentoSectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        pin: true,
      }
    })
    .fromTo(".macbook-frame", 
      { scale: 0.65, rotateX: 12, transformPerspective: 1200 },
      { scale: 1.05, rotateX: 0, ease: "none" }
    )
    .fromTo(".macbook-screen-overlay",
      { clipPath: "circle(0% at 50% 50%)" },
      { clipPath: "circle(150% at 50% 50%)", ease: "none" },
      "<"
    )
    .fromTo(".macbook-screen-content",
      { yPercent: 8 },
      { yPercent: 0, ease: "none" },
      "<"
    )
    .fromTo(".macbook-inner-card",
      { yPercent: 20 },
      { yPercent: 0, ease: "none" },
      "<"
    );

    // 2. LeetCode Deep Sync wave reveal
    gsap.to({ progress: 0 }, {
      progress: 1,
      scrollTrigger: {
        trigger: syncSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
        onUpdate: (self) => {
          syncProgressRef.current = self.progress;
          drawGrid(self.progress, theme);
        }
      }
    });

    // 3. Readiness speedometer cockpit gauge
    const readinessTl = gsap.timeline({
      scrollTrigger: {
        trigger: readinessSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
      }
    });

    readinessTl.fromTo(".readiness-gauge-arc",
      { strokeDashoffset: 307 },
      { strokeDashoffset: 307 - (0.72 * 307), ease: "none" }
    )
    .fromTo(".readiness-needle-group",
      { rotate: -110 },
      { rotate: -110 + (0.72 * 220), ease: "none" },
      "<"
    );

    const counterObj = { score: 0 };
    readinessTl.to(counterObj, {
      score: 72,
      snap: { score: 1 },
      ease: "none",
      onUpdate: () => {
        const el = document.getElementById("readiness-score-val");
        if (el) el.innerText = `${counterObj.score}%`;
      }
    }, "<");

    readinessTl.fromTo(".readiness-company-tag",
      { scale: 0, opacity: 0, x: 0, y: 0 },
      {
        scale: 1,
        opacity: 1,
        x: (i, el) => parseFloat(el.getAttribute("data-tx") || "0"),
        y: (i, el) => parseFloat(el.getAttribute("data-ty") || "0"),
        stagger: 0.05,
        ease: "back.out(1.5)",
      },
      "0.3"
    );

    readinessTl.fromTo(".readiness-pulse-ring",
      { scale: 0.6, opacity: 0 },
      { scale: 1.4, opacity: 0.8, duration: 0.3, ease: "power1.out" },
      "0.7"
    )
    .to(".readiness-pulse-ring", {
      opacity: 0,
      scale: 1.8,
      duration: 0.2,
      ease: "power1.in"
    });

    // 4. AI Copilot Drawer Materialization
    const copilotTl = gsap.timeline({
      scrollTrigger: {
        trigger: assistantSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
      }
    });

    copilotTl.fromTo(".copilot-drawer",
      { width: 0 },
      { width: 340, ease: "power2.out" }
    )
    .fromTo(".copilot-editor-pane",
      { filter: "brightness(1)" },
      { filter: "brightness(0.65)", ease: "none" },
      "<"
    )
    .fromTo(".copilot-msg",
      { opacity: 0, filter: "blur(5px)", y: 10 },
      { opacity: 1, filter: "blur(0)", y: 0, stagger: 0.2, ease: "power1.out" },
      "0.2"
    )
    .fromTo(".copilot-code-line",
      { opacity: 0.15 },
      { opacity: 1, stagger: 0.1, ease: "none" },
      "0.1"
    );

    // 5. Semantic Filter Gravity Well
    gsap.timeline({
      scrollTrigger: {
        trigger: semanticSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          const tags = document.querySelectorAll(".semantic-floating-tag");
          
          tags.forEach((tag, idx) => {
            const dx = parseFloat(tag.getAttribute("data-dx") || "0");
            const dy = parseFloat(tag.getAttribute("data-dy") || "0");
            const r = parseFloat(tag.getAttribute("data-r") || "30");
            const phase = parseFloat(tag.getAttribute("data-phase") || "0");

            let opacity = 0;
            let scale = 1;
            let x = dx;
            let y = dy;
            let blur = 0;

            if (p < 0.2) {
              opacity = p / 0.2;
            } else if (p < 0.6) {
              opacity = 1;
              const angle = (p - 0.2) * Math.PI * 2 + (phase * Math.PI / 180);
              x = dx + Math.cos(angle) * r;
              y = dy + Math.sin(angle) * r;
            } else if (p < 0.85) {
              const collapseProg = (p - 0.6) / 0.25;
              const eased = collapseProg * collapseProg * collapseProg;
              const angle = 0.8 * Math.PI * 2 + (phase * Math.PI / 180);
              const orbitX = dx + Math.cos(angle) * r;
              const orbitY = dy + Math.sin(angle) * r;

              x = orbitX * (1 - eased);
              y = orbitY * (1 - eased);
              scale = 1 - eased * 0.4;
              opacity = 1 - eased;
              blur = eased * 8;
            }

            (tag as HTMLElement).style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
            (tag as HTMLElement).style.opacity = `${opacity}`;
            (tag as HTMLElement).style.filter = blur > 0.5 ? `blur(${blur}px)` : "none";
          });

          const input = document.querySelector(".semantic-search-input") as HTMLInputElement;
          if (input) {
            if (p > 0.85) {
              input.value = "Hard dynamic programming questions asked in Google SWE interviews";
              const box = document.querySelector(".semantic-search-box") as HTMLElement;
              if (box) {
                box.style.boxShadow = `0 0 16px 4px rgba(var(--foreground-rgb), 0.08)`;
                box.style.borderColor = "var(--foreground)";
              }
            } else {
              input.value = "";
              const box = document.querySelector(".semantic-search-box") as HTMLElement;
              if (box) {
                box.style.boxShadow = "none";
                box.style.borderColor = "var(--border)";
              }
            }
          }
        }
      }
    });

    // 6. Placement Sprints 3D Timeline Ribbon (Pinning active segment)
    const sprintTl = gsap.timeline({
      scrollTrigger: {
        trigger: sprintSectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        pin: true,
      }
    });

    const cardElements = gsap.utils.toArray(".sprint-3d-card");
    const totalCards = cardElements.length;

    cardElements.forEach((card: any, idx: number) => {
      const startAt = idx / totalCards;
      const activeAt = (idx + 0.5) / totalCards;

      gsap.set(card, {
        transformPerspective: 1200,
        transformStyle: "preserve-3d",
        z: -idx * 250,
        rotateY: 12,
        opacity: idx === 0 ? 1 : 0.4 - (idx * 0.1)
      });

      sprintTl.to(card, {
        z: 0,
        rotateY: 0,
        opacity: 1,
        duration: 0.5,
        ease: "power1.out"
      }, startAt * 2);

      if (idx < totalCards - 1) {
        sprintTl.to(card, {
          x: -400,
          rotateY: -20,
          opacity: 0,
          duration: 0.5,
          ease: "power1.in"
        }, activeAt * 2);
      }
    });

    // 7. Premium Pricing Monolith Rise
    const pricingTl = gsap.timeline({
      scrollTrigger: {
        trigger: pricingSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
      }
    });

    pricingTl.fromTo(".pricing-monolith-card",
      { y: 120 },
      { y: 0, ease: "power2.out" }
    )
    .fromTo(".pricing-standard-card",
      { filter: "grayscale(0) opacity(1)" },
      { filter: "grayscale(1) opacity(0.55)", ease: "none" },
      "<"
    )
    .fromTo(".pricing-laser-line",
      { top: "0%", opacity: 0 },
      { top: "100%", opacity: 0.6, ease: "power1.inOut" }
    )
    .fromTo(".pricing-monolith-card",
      { boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)" },
      { boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", ease: "power2.out" },
      "<"
    );

    // 8. FAQ Animation
    gsap.fromTo(".faq-container",
      { opacity: 0, y: 30 },
      {
        opacity: 1,
        y: 0,
        scrollTrigger: {
          trigger: faqSectionRef.current,
          start: "top 85%",
          end: "bottom 15%",
          scrub: true,
        }
      }
    );

    // 9. Ambient shifts temperature variable on scroll
    ScrollTrigger.create({
      trigger: "body",
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        const warmth = self.progress;
        document.documentElement.style.setProperty("--bg-grad-warmth", `${warmth}`);
      }
    });

  }, { scope: pageRef, dependencies: [activeSprintDuration] });

  return (
    <div ref={pageRef} className="flex flex-col min-h-screen relative overflow-hidden bg-background">
      {/* Background grid + ambient gradient */}
      <div className="fixed inset-0 z-0 grid-bg" aria-hidden="true">
        <div className="grid-sweep" />
      </div>

      {/* Particles */}
      <AntigravityParticles />

      {/* ─────────── NAV ─────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40">
        <div
          className="backdrop-blur-xl bg-background/70 transition-colors duration-500"
          style={{ WebkitBackdropFilter: "blur(20px)" }}
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
            <Link href="/" className="flex items-center gap-2.5 group">
              <Terminal className="h-5 w-5 text-foreground opacity-70 group-hover:opacity-100 transition-opacity" />
              <span className="text-[15px] font-light tracking-wide">
                Prep<span className="font-semibold">Assist</span>
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a
                href="#sync"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                Deep Sync
              </a>
              <a
                href="#readiness"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                Readiness
              </a>
              <a
                href="#assistant"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                AI Assistant
              </a>
              <a
                href="#sprints"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                Sprints
              </a>
              <a
                href="#pricing"
                className="text-[11px] text-muted hover:text-foreground transition-colors tracking-widest uppercase font-mono"
              >
                Pricing
              </a>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="text-[13px] text-muted hover:text-foreground transition-colors cursor-pointer px-3 py-1.5 font-light">
                    Sign In
                  </button>
                </SignInButton>
                <Link
                  href="/sign-up"
                  className="px-5 py-2 text-[13px] font-medium bg-foreground text-background rounded-full hover:opacity-90 transition-opacity"
                >
                  Get Started
                </Link>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="px-5 py-2 text-[13px] font-medium bg-foreground text-background rounded-full hover:opacity-90 transition-opacity flex items-center gap-1.5"
                >
                  Dashboard <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Show>
            </div>
          </div>
        </div>
      </nav>

      {/* ─────────── HERO ─────────── */}
      <section
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-40 pb-20 text-center"
      >
        <div className="max-w-4xl">
          {/* Badge pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-10 rounded-full border border-border bg-surface/40 text-[11px] uppercase tracking-[0.18em] text-muted font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
            </span>
            Real-time LeetCode profile analytics enabled
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-[5.5rem] leading-[1.02] tracking-tight mb-8">
            <span className="font-extralight block">
              <SplitText text="Personalized study plans for" delayOffset={100} />
            </span>
            <span className="font-bold gradient-text">
              <SplitText text="your dream tech offers" delayOffset={500} />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-muted max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            Stop solving random questions. PrepAssist syncs your LeetCode metrics and uses
            AI to generate custom, day-by-day study calendars targeting top companies.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <Show when="signed-out">
              <Link
                href="/sign-up"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="magnetic-btn px-8 py-3.5 bg-foreground text-background font-medium text-[14px] rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
              >
                Create study plan <ChevronRight className="h-4 w-4" />
              </Link>
            </Show>
            <Show when="signed-in">
              <Link
                href="/sheets/new"
                onMouseMove={handleMagneticMove}
                onMouseLeave={handleMagneticLeave}
                className="magnetic-btn px-8 py-3.5 bg-foreground text-background font-medium text-[14px] rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 shadow-lg"
              >
                Create study plan <ChevronRight className="h-4 w-4" />
              </Link>
            </Show>
            <Link
              href="/sheets/new"
              onMouseMove={handleMagneticMove}
              onMouseLeave={handleMagneticLeave}
              className="magnetic-btn px-8 py-3.5 border border-border text-foreground/75 hover:text-foreground font-medium text-[14px] rounded-full hover:border-foreground/30 transition-all"
            >
              Explore Templates
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── BENTO PREVIEW (LAPTOP ZOOM & SCREEN BLOOM) ─────────── */}
      <section ref={bentoSectionRef} id="preview" className="relative h-[250vh] z-10 w-full">
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
          <div className="macbook-frame relative w-full max-w-4xl aspect-[16/10] bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-4 overflow-hidden flex flex-col justify-between">
            {/* Bezel header */}
            <div className="flex items-center gap-2 pb-2.5 border-b border-border/20">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
              <span className="ml-4 text-[10px] text-muted font-mono tracking-widest uppercase">
                PrepAssist — Study Planner Dashboard Preview
              </span>
            </div>

            {/* Screen Content Window */}
            <div className="relative w-full flex-1 bg-background rounded-lg overflow-hidden border border-zinc-800">
              
              {/* MacBook Screen Content (Parallax layers inside screen) */}
              <div className="macbook-screen-content absolute inset-0 grid md:grid-cols-3 gap-px bg-border/20">
                {/* Schedule panel */}
                <div className="md:col-span-2 p-8 space-y-6 bg-surface/40 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-wide">
                      Target: Google SWE L4
                    </h3>
                    <span className="text-[10px] text-muted font-mono uppercase tracking-widest">
                      Week 1 / 6
                    </span>
                  </div>

                  <div className="space-y-4">
                    {[
                      { day: "Day 1", topic: "Arrays & Hashing", done: true, badge: "Easy" },
                      { day: "Day 2", topic: "Dynamic Programming", done: false, badge: "Hard" },
                      { day: "Day 3", topic: "Graphs & BFS / DFS", done: false, badge: "Medium" },
                    ].map((item) => (
                      <div
                        key={item.day}
                        className="macbook-inner-card flex items-center gap-4 py-4 px-5 rounded-xl border border-border/30 bg-surface/60 hover:border-foreground/10 hover:bg-surface-elevated/40 transition-all duration-300 animate-fade-in"
                      >
                        {item.done ? (
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted/30 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <span className="text-[9px] text-muted font-mono uppercase tracking-widest block mb-0.5">
                            {item.day}
                          </span>
                          <p className={`text-sm ${item.done ? "line-through text-muted/70" : "text-foreground"}`}>
                            {item.topic}
                          </p>
                        </div>
                        <span
                          className={`text-[9px] px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider ${
                            item.badge === "Easy" ? "badge-easy" : item.badge === "Hard" ? "badge-hard" : "badge-medium"
                          }`}
                        >
                          {item.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI chat panel */}
                <div className="p-8 flex flex-col justify-between bg-surface/20 min-h-[300px]">
                  <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted">
                    <Sparkles className="h-4 w-4 text-foreground/60" />
                    AI Assistant
                  </div>

                  <div className="space-y-4 text-left">
                    <div className="flex gap-3 items-start">
                      <MessageSquare className="h-4 w-4 mt-1 text-muted shrink-0" />
                      <p className="text-[13px] text-muted leading-relaxed font-light">
                        Based on your target role at Google, I recommend
                        focusing on <span className="text-foreground font-medium">Dynamic Programming</span> today.
                        35% of L4 interviews feature DP.
                      </p>
                    </div>

                    <button className="w-full text-center text-[12px] font-medium py-2.5 bg-foreground text-background hover:opacity-90 rounded-lg transition-opacity cursor-pointer">
                      Load DP practice →
                    </button>
                  </div>
                </div>
              </div>

              {/* Laser Screen Bloom overlay mask */}
              <div className="macbook-screen-overlay absolute inset-0 bg-black pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 1: LEETCODE DEEP SYNC ─────────── */}
      <section ref={syncSectionRef} id="sync" className="relative z-10 px-6 py-28 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5 space-y-6 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <RefreshCw className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              LeetCode Deep Sync <span className="font-semibold block">Heatmap Sweep</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Extract your submission history securely in one click. We translate raw timestamps, solve metrics, and language patterns dynamically on our neural contribution grid.
            </p>
            <div className="space-y-3 pt-2 font-mono text-[12px] text-muted">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Raw submission history extraction
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Secure local session token syncing
              </div>
            </div>
          </div>

          <div className="md:col-span-7 flex flex-col items-center">
            <ParallaxCard className="w-full" tilt={2}>
              <div className="glass-card p-6 border border-border/40 space-y-5 text-left font-mono">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${syncComplete ? "bg-success" : "bg-warning animate-pulse"}`} />
                    <span className="text-[11px] text-muted uppercase tracking-wider">
                      {syncComplete ? "Sync Complete" : "Syncing metrics..."}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">{syncCount} / 1284 solved</span>
                </div>

                {/* Heatmap Grid Canvas */}
                <div className="flex justify-center py-2 bg-surface/10 rounded-xl border border-border/10 overflow-hidden">
                  <canvas ref={canvasRef} className="opacity-90" />
                </div>

                <div className="flex justify-between items-center text-xs text-muted pt-2 border-t border-border/10">
                  <span>Extracting submission metadata...</span>
                  {syncComplete && (
                    <svg className="w-5 h-5 text-success animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
            </ParallaxCard>
          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 2: READINESS INDEX ─────────── */}
      <section ref={readinessSectionRef} id="readiness" className="relative z-10 px-6 py-28 bg-surface/5 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Radar Speedometer layout */}
          <div className="md:col-span-7 relative flex items-center justify-center h-[340px] overflow-visible">
            
            {/* Pulse expanding concentric ring */}
            <div className="readiness-pulse-ring absolute rounded-full border border-foreground/30 pointer-events-none w-64 h-64 opacity-0" />
            
            <div className="relative z-10 bg-surface/40 p-8 border border-border/30 rounded-full flex items-center justify-center shadow-lg w-72 h-72">
              <svg className="w-56 h-56 overflow-visible" viewBox="0 0 200 200">
                {/* Arc Track */}
                <path
                  d="M 40 160 A 80 80 0 1 1 160 160"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Arc Progress */}
                <path
                  className="readiness-gauge-arc"
                  d="M 40 160 A 80 80 0 1 1 160 160"
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray="307"
                  strokeDashoffset="307"
                />
                {/* Needle */}
                <g className="readiness-needle-group" style={{ transformOrigin: "100px 100px" }}>
                  <polygon
                    points="97,100 100,20 103,100"
                    fill="var(--foreground)"
                  />
                  <circle cx="100" cy="100" r="6" fill="var(--foreground)" />
                </g>
              </svg>

              {/* Monospace score readout inside gauge */}
              <div className="absolute text-center mt-6">
                <span id="readiness-score-val" className="text-4xl font-semibold tracking-tight text-foreground font-mono">0%</span>
                <span className="text-[10px] text-muted font-mono uppercase tracking-widest block mt-1">Readiness</span>
              </div>
            </div>

            {/* Radial Company Target tags */}
            {[
              { label: "Google", angle: -30, tx: -70, ty: -100 },
              { label: "Meta", angle: 45, tx: 100, ty: -40 },
              { label: "Stripe", angle: -135, tx: -100, ty: 50 },
              { label: "Uber", angle: 120, tx: 80, ty: 80 },
            ].map((tag, i) => (
              <span
                key={i}
                className="readiness-company-tag absolute px-3 py-1 border border-border bg-surface-elevated/95 rounded-full text-[10px] font-mono text-muted uppercase tracking-wider shadow opacity-0 scale-0"
                data-tx={tag.tx}
                data-ty={tag.ty}
                style={{ left: "50%", top: "50%" }}
              >
                {tag.label}
              </span>
            ))}
          </div>

          <div className="md:col-span-5 space-y-6 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <Gauge className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              Readiness Score <span className="font-semibold block">Cockpit Diagnostics</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Evaluate your topic coverage parameters across top recruiter indices. Your Readiness gauge sweeps matching sub-problems, fanning targets dynamically for high-contrast lock.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 3: AI PROBLEM ASSISTANT ─────────── */}
      <section ref={assistantSectionRef} id="assistant" className="relative z-10 px-6 py-28 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-5 space-y-6 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <Cpu className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              AI Problem Assistant <span className="font-semibold block">IDE Materialization</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Open drawer interfaces to resolve difficult state transitions. Watch solutions materialize chronologically via line blur reveals alongside dynamic trace tabs.
            </p>
          </div>

          {/* Editor + Copilot Drawer */}
          <div className="md:col-span-7 grid grid-cols-12 gap-3 relative h-[380px] w-full">
            {/* Editor Pane (Left) */}
            <div className="copilot-editor-pane col-span-7 bg-surface/50 border border-border rounded-2xl p-5 font-mono text-[11px] text-left overflow-y-auto shadow h-full">
              <div className="flex items-center gap-1.5 pb-3 border-b border-border/10 mb-4">
                <span className="w-2 h-2 rounded-full bg-border" />
                <span className="text-[9px] text-muted">solution.py</span>
              </div>
              <pre className="text-muted space-y-2.5">
                <code className="copilot-code-line block">
                  <span className="text-foreground">def</span> <span className="text-muted">minDistance</span>(s1, s2):
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;m, n = len(s1), len(s2)
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;dp = [[0] * (n + 1) <span className="text-foreground">for</span> _ <span className="text-foreground">in</span> range(m + 1)]
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;<span className="text-foreground">for</span> i <span className="text-foreground">in</span> range(m + 1): dp[i][0] = i
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;<span className="text-foreground">for</span> j <span className="text-foreground">in</span> range(n + 1): dp[0][j] = j
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;<span className="text-foreground">for</span> i <span className="text-foreground">in</span> range(1, m + 1):
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-foreground">for</span> j <span className="text-foreground">in</span> range(1, n + 1):
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-foreground">if</span> s1[i-1] == s2[j-1]:
                </code>
                <code className="copilot-code-line block">
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dp[i][j] = dp[i-1][j-1]
                </code>
              </pre>
            </div>

            {/* Copilot Drawer (Right) */}
            <div className="col-span-5 h-full relative overflow-hidden flex items-center justify-end">
              <div
                className="copilot-drawer bg-surface border border-border rounded-2xl absolute top-0 right-0 bottom-0 overflow-hidden text-left flex flex-col justify-between shadow-lg h-full"
                style={{ width: "0px" }}
              >
                <div className="p-4 border-b border-border bg-surface/20 flex items-center justify-between">
                  <span className="text-[10px] font-semibold font-mono uppercase tracking-wider text-foreground">AI Assistant</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                </div>
                
                <div className="p-4 flex-1 space-y-4 overflow-y-auto font-sans">
                  <div className="copilot-msg p-3 bg-surface-elevated/30 border border-border/30 rounded-xl">
                    <span className="text-[8px] font-mono text-muted uppercase tracking-wider block mb-1">Response</span>
                    <p className="text-[11px] text-foreground leading-normal font-light">
                      Analyzing Edit Distance matrix. Deleting a character reduces dimensions by <span className="font-semibold text-foreground font-mono">dp[i-1][j] + 1</span>.
                    </p>
                  </div>
                  <div className="copilot-msg p-3 bg-surface-elevated/30 border border-border/30 rounded-xl">
                    <span className="text-[8px] font-mono text-muted uppercase tracking-wider block mb-1">Complexity</span>
                    <p className="text-[11px] text-foreground leading-normal font-mono">
                      Time: O(M * N) | Space: O(M * N)
                    </p>
                  </div>
                  <div className="copilot-msg p-2 bg-surface-elevated/20 border border-border/30 rounded-lg text-center mt-4">
                    <p className="text-[10px] text-foreground font-mono">
                      Resolving trace table... <span className="animate-[blink_0.53s_infinite] font-bold">|</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 4: SEMANTIC FILTER SEARCH ─────────── */}
      <section ref={semanticSectionRef} className="relative z-10 px-6 py-28 bg-surface/5 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Orbital Gravity Well display */}
          <div className="md:col-span-7 order-2 md:order-1 relative flex items-center justify-center h-[300px]">
            <div className="relative w-full max-w-sm">
              <div className="semantic-search-box p-3 bg-surface border border-border rounded-xl flex items-center z-10 relative transition-all duration-300">
                <Search className="h-4 w-4 text-muted ml-2" />
                <input
                  type="text"
                  disabled
                  className="semantic-search-input bg-transparent text-xs font-light text-foreground flex-1 ml-2 border-0 outline-0 outline-none focus:outline-none"
                  value=""
                />
              </div>

              {/* Outer floating orbital tags */}
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                {[
                  { text: "Google Target", dx: -110, dy: -60, r: 35 },
                  { text: "Dynamic Programming", dx: 110, dy: -50, r: 40 },
                  { text: "Hard Difficulty", dx: -120, dy: 50, r: 30 },
                  { text: "Graph Search", dx: 120, dy: 60, r: 45 },
                  { text: "Staggered Orbit", dx: -20, dy: -90, r: 35 },
                ].map((tag, idx) => (
                  <span
                    key={idx}
                    className="semantic-floating-tag absolute px-3 py-1 rounded-full border border-border bg-surface-elevated/95 text-[9px] font-mono text-muted whitespace-nowrap shadow-sm opacity-0 scale-0"
                    data-dx={tag.dx}
                    data-dy={tag.dy}
                    data-r={tag.r}
                    data-phase={idx * 72}
                    style={{
                      left: "50%",
                      top: "50%",
                    }}
                  >
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="md:col-span-5 order-1 md:order-2 space-y-6 text-left">
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <Search className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-extralight tracking-tight text-foreground">
              Semantic AI Filter <span className="font-semibold block">Gravity Well Collapse</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Type query strings in conversational English. Floating keyword tags orbit your search container before collapsing inside a motion-blur gravity well to trigger search parameters.
            </p>
          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 5: PLACEMENT SPRINTS ─────────── */}
      <section ref={sprintSectionRef} id="sprints" className="relative h-[300vh] z-10 w-full">
        <div className="sticky top-0 h-screen w-full flex items-center justify-center overflow-hidden">
          <div className="max-w-5xl w-full px-6 grid md:grid-cols-12 gap-12 items-center">
            
            <div className="md:col-span-5 text-left space-y-6">
              <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
                <Calendar className="h-5 w-5" />
              </div>
              <h2 className="text-3xl font-extralight tracking-tight text-foreground">
                Placement Sprints <span className="font-semibold block">3D Timeline Ribbon</span>
              </h2>
              <p className="text-muted leading-relaxed font-light text-sm">
                Select your timeline speed. Watch target phase cards deal forward along the Z-axis, wiping text reveals cleanly into the front viewport.
              </p>
              
              <div className="flex gap-2.5 pt-2">
                {[15, 30, 60].map((dur) => (
                  <button
                    key={dur}
                    onClick={() => setActiveSprintDuration(dur as any)}
                    className={`px-4 py-1.5 rounded-full text-xs font-mono border transition-all cursor-pointer ${
                      activeSprintDuration === dur
                        ? "bg-foreground border-foreground text-background font-semibold"
                        : "bg-surface border-border text-muted hover:border-foreground/30"
                    }`}
                  >
                    {dur} Days
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Timeline ribbon track */}
            <div 
              className="md:col-span-7 w-full h-[360px] relative flex items-center justify-center"
              style={{ perspective: "1200px", transformStyle: "preserve-3d" }}
            >
              {sprintSchedules[activeSprintDuration].map((card, idx) => (
                <div
                  key={idx}
                  className="sprint-3d-card absolute w-[340px] p-6 bg-surface/90 border border-border rounded-2xl shadow-xl flex flex-col justify-between h-[210px] will-change-transform"
                  style={{
                    zIndex: 10 - idx
                  }}
                >
                  <div className="text-left">
                    <span className="text-[9px] text-muted font-mono uppercase tracking-widest block mb-2">{card.week}</span>
                    <h4 className="text-sm font-semibold text-foreground leading-normal">
                      {card.topic}
                    </h4>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border/20">
                    <span className="text-xs text-muted font-mono">{card.count} problems</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full border border-success/40 bg-success/5 text-success uppercase tracking-wider font-mono">Curated</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 6: PREMIUM PRICING ─────────── */}
      <section ref={pricingSectionRef} id="pricing" className="relative z-10 px-6 py-28 scroll-reveal-container">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <div className="inline-flex p-3 rounded-2xl bg-surface border border-border text-foreground/80">
              <CreditCard className="h-5 w-5" />
            </div>
            <h2 className="text-4xl font-extralight tracking-tight text-foreground">
              Flexible Subscriptions <span className="font-semibold block">Upgrade preparation status</span>
            </h2>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => setBillingPeriod("monthly")}
                className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-all ${
                  billingPeriod === "monthly"
                    ? "bg-foreground border-foreground text-background"
                    : "bg-surface border-border text-muted hover:border-foreground/25"
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingPeriod("annual")}
                className={`px-3 py-1 rounded-full text-[10px] font-mono border transition-all ${
                  billingPeriod === "annual"
                    ? "bg-foreground border-foreground text-background"
                    : "bg-surface border-border text-muted hover:border-foreground/25"
                }`}
              >
                Annual (-33%)
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto items-stretch">
            {/* Standard pricing card */}
            <div className="pricing-standard-card p-8 bg-surface/30 border border-border rounded-3xl flex flex-col justify-between transition-all duration-300">
              <div className="space-y-6 text-left">
                <div>
                  <h3 className="text-xs font-light text-muted font-mono uppercase tracking-widest">Standard</h3>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">Free</span>
                  </div>
                  <p className="text-xs text-muted font-light mt-3">Foundational study templates and metric tracking.</p>
                </div>
                
                <ul className="space-y-3 font-mono text-[10px] text-muted border-t border-border/15 pt-4">
                  <li className="flex items-center gap-2">• Profile importing diagnostics</li>
                  <li className="flex items-center gap-2">• Basic 15-day study sprints</li>
                  <li className="flex items-center gap-2">• Limited Copilot suggestions</li>
                </ul>
              </div>
              
              <button className="w-full text-center text-xs py-3 border border-border rounded-xl text-foreground font-medium hover:border-foreground/30 mt-8 transition-colors">
                Get Started
              </button>
            </div>

            {/* Premium pricing card (Monolith) */}
            <div className="pricing-monolith-container relative rounded-3xl overflow-hidden shadow-2xl">
              <div 
                className="pricing-monolith-card p-8 bg-surface border border-border rounded-3xl flex flex-col justify-between h-full relative will-change-transform"
              >
                {/* Scanner sweep beam line */}
                <div className="pricing-laser-line absolute left-0 right-0 h-px bg-foreground opacity-0 pointer-events-none" />

                <div className="space-y-6 text-left">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xs font-semibold text-foreground font-mono uppercase tracking-widest">Premium</h3>
                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-foreground">
                          ${billingPeriod === "annual" ? "8" : "12"}
                        </span>
                        <span className="text-xs text-muted">/month</span>
                      </div>
                      <p className="text-xs text-muted font-light mt-3">Full access to dynamic dashboard modules and co-piloting.</p>
                    </div>
                    <span className="px-2 py-0.5 border border-foreground/30 text-foreground text-[8px] rounded-full uppercase tracking-wider font-mono">Popular</span>
                  </div>

                  <ul className="space-y-3 font-mono text-[10px] text-foreground/80 border-t border-border/15 pt-4">
                    <li className="flex items-center gap-2">• Automatic Deep Sync</li>
                    <li className="flex items-center gap-2">• Concentric Speedometer Readiness</li>
                    <li className="flex items-center gap-2">• 3D Timeline Ribbon Sprints</li>
                    <li className="flex items-center gap-2">• AI Filter Gravity Well Search</li>
                  </ul>
                </div>

                <button className="w-full text-center text-xs py-3 bg-foreground text-background rounded-xl font-semibold hover:opacity-90 mt-8 transition-opacity">
                  Upgrade Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── DEEP DIVE QUESTIONS (SCROLL ROTATE) ─────────── */}
      <section ref={faqSectionRef} className="relative z-10 px-6 py-28 max-w-4xl mx-auto text-left scroll-reveal-container">
        <div className="faq-container">
          <h2 className="text-3xl font-extralight tracking-tight mb-16 text-center">
            Preparation FAQ
          </h2>
          <div className="space-y-6">
            {[
              {
                title: "What templates are supported?",
                desc: "We parse current interview data from 25+ top firms including Google, Amazon, Meta, Netflix, Microsoft, Apple, Uber, Lyft, ByteDance, Airbnb, and Stripe. Sheets range from 15-day sprints to 60-day thorough trackers."
              },
              {
                title: "How does the AI personalization customize my sheet?",
                desc: "If you connect LeetCode profile statistics, our system detects solved patterns. We filter out elements you already master and emphasize topics that present active performance drops, keeping your prep efficient."
              },
              {
                title: "Are solutions and code translations reliable?",
                desc: "Solutions pull verified database answers first. If translations or explanations require dynamic scaling, Google Gemini generates correct alternative Big-O implementations along with line-by-line analyses."
              }
            ].map((faq, i) => (
              <div key={i} className="p-6 glass-card border border-border/30 hover:border-foreground/25 transition-all duration-300">
                <h4 className="text-base font-semibold text-foreground mb-2">{faq.title}</h4>
                <p className="text-sm text-muted leading-relaxed font-light">{faq.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="relative z-10 border-t border-border/20 px-6 py-8 bg-background/40">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-[12px] text-muted">
          <div className="flex items-center gap-3">
            <span className="font-light tracking-wide text-[13px]">
              Prep<span className="font-semibold text-foreground/80">Assist</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-surface/50 text-[10px] font-mono tracking-wider">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success/60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-success" />
              </span>
              Operational
            </span>
          </div>

          <div className="flex items-center gap-8 font-mono text-[10px] uppercase tracking-wider">
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Privacy
            </span>
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Terms
            </span>
            <span className="hover:text-foreground transition-colors cursor-pointer">
              Security
            </span>
          </div>

          <span className="font-light text-[11px]">
            © {new Date().getFullYear()} PrepAssist. Built for placements.
          </span>
        </div>
      </footer>

      {/* Custom float layers */}
      <CustomCursor />
      <SectionProgressIndicator />
    </div>
  );
}
