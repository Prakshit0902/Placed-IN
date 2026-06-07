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
          <span key={wIdx} className="inline-block" style={{ whiteSpace: "nowrap" }}>
            {wordChars.map((char, cIdx) => {
              const delay = delayOffset + globalCharIndex * 20;
              globalCharIndex++;
              return (
                <span
                  key={cIdx}
                  className="text-foreground"
                  style={{
                    display: "inline-block",
                    opacity: 0,
                    transform: "translateY(8px)",
                    animation: `fade-in 0.5s ease-out forwards ${delay}ms`,
                  }}
                >
                  {char}
                </span>
              );
            })}
            {wIdx < text.split(" ").length - 1 && (
              <span className="text-foreground" style={{ display: "inline-block" }}>
                &nbsp;
              </span>
            )}
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

  // States
  const [activeExplainTab, setActiveExplainTab] = useState<"analogy" | "dryrun" | "hints" | "complexity">("analogy");
  const [syncCount, setSyncCount] = useState(0);
  const [syncComplete, setSyncComplete] = useState(false);
  const [activeSprintDuration, setActiveSprintDuration] = useState<15 | 30 | 60>(30);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");

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
  // GSAP animations Orchestration
  useGSAP(() => {
    // 1. MacBook Bento Preview (3D opening lid & interactive depth)
    gsap.timeline({
      scrollTrigger: {
        trigger: bentoSectionRef.current,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        pin: true,
      }
    })
    .fromTo(".macbook-container-3d", 
      { rotateX: 18, rotateY: -10, scale: 0.6 },
      { rotateX: 0, rotateY: 0, scale: 1.02, ease: "none" }
    )
    .fromTo(".macbook-screen-lid",
      { rotateX: -95 },
      { rotateX: 0, ease: "none" },
      "<"
    )
    .fromTo(".macbook-screen-content",
      { yPercent: 12 },
      { yPercent: 0, ease: "none" },
      "<"
    )
    .fromTo(".macbook-inner-card",
      { z: -85, opacity: 0 },
      { z: 0, opacity: 1, stagger: 0.05, ease: "none" },
      "<"
    );

    // 2. LeetCode Deep Sync wave reveal & 3D bar extrusion
    const syncProgressObj = { progress: 0 };
    gsap.to(syncProgressObj, {
      progress: 1,
      scrollTrigger: {
        trigger: syncSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
      },
      onUpdate: () => {
        setSyncCount(Math.floor(syncProgressObj.progress * 1284));
        if (syncProgressObj.progress >= 0.9) {
          setSyncComplete(true);
        } else {
          setSyncComplete(false);
        }

        // Extrude blocks dynamically based on sync progress
        const blocks = document.querySelectorAll(".heatmap-block-3d");
        blocks.forEach((block: any, i) => {
          const threshold = (i % 20) / 20;
          if (syncProgressObj.progress > threshold) {
            const h = (i * 17) % 5 === 0 ? 24 : (i * 11) % 3 === 0 ? 12 : 3;
            const activeProg = Math.min(1, (syncProgressObj.progress - threshold) * 5);
            block.style.transform = `translateZ(${h * activeProg}px)`;
            block.style.opacity = "1";
          } else {
            block.style.transform = "translateZ(0px)";
            block.style.opacity = "0.2";
          }
        });
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
      { scale: 0, opacity: 0, x: 0, y: 0, z: 0 },
      {
        scale: 1,
        opacity: 1,
        x: (i, el) => parseFloat(el.getAttribute("data-tx") || "0"),
        y: (i, el) => parseFloat(el.getAttribute("data-ty") || "0"),
        z: 40,
        stagger: 0.05,
        ease: "back.out(1.4)",
      },
      "0.3"
    );

    readinessTl.fromTo(".readiness-pulse-ring",
      { scale: 0.5, opacity: 0, z: -10 },
      { scale: 1.3, opacity: 0.8, z: 15, duration: 0.4, ease: "power1.out" },
      "0.6"
    )
    .to(".readiness-pulse-ring", {
      opacity: 0,
      scale: 1.6,
      z: 30,
      duration: 0.2,
      ease: "power1.in"
    });

    // 4. AI Copilot 3D Prism Workspace Rotation
    const prismObj = { rotation: 0 };
    gsap.fromTo(prismObj, 
      { rotation: 0 },
      {
        rotation: -240,
        scrollTrigger: {
          trigger: assistantSectionRef.current,
          start: "top 80%",
          end: "bottom 20%",
          scrub: true,
        },
        onUpdate: () => {
          const el = document.querySelector(".prism-container-3d") as HTMLElement;
          if (el) {
            el.style.setProperty("--prism-rotation", `${prismObj.rotation}deg`);
          }
        }
      }
    );

    // 5. Semantic AI Filter 3D Vortex Orbit
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
            const dz = parseFloat(tag.getAttribute("data-dz") || "0");
            const r = parseFloat(tag.getAttribute("data-r") || "30");
            const phase = parseFloat(tag.getAttribute("data-phase") || "0");

            let opacity = 0;
            let scale = 1;
            let x = dx;
            let y = dy;
            let z = dz;
            let blur = 0;

            if (p < 0.2) {
              opacity = p / 0.2;
              z = dz + (1 - opacity) * 100;
            } else if (p < 0.6) {
              opacity = 1;
              const angle = (p - 0.2) * Math.PI * 2.5 + (phase * Math.PI / 180);
              x = dx + Math.cos(angle) * r;
              y = dy + Math.sin(angle) * r;
              z = dz + Math.sin(angle * 1.5) * 30;
            } else if (p < 0.85) {
              const collapseProg = (p - 0.6) / 0.25;
              const eased = collapseProg * collapseProg * collapseProg;
              const angle = 0.8 * Math.PI * 2.5 + (phase * Math.PI / 180);
              const orbitX = dx + Math.cos(angle) * r;
              const orbitY = dy + Math.sin(angle) * r;
              const orbitZ = dz + Math.sin(angle * 1.5) * 30;

              x = orbitX * (1 - eased);
              y = orbitY * (1 - eased);
              z = orbitZ * (1 - eased) - eased * 80;
              scale = 1 - eased * 0.6;
              opacity = 1 - eased;
              blur = eased * 8;
            }

            (tag as HTMLElement).style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`;
            (tag as HTMLElement).style.opacity = `${opacity}`;
            (tag as HTMLElement).style.filter = blur > 0.5 ? `blur(${blur}px)` : "none";
          });

          const input = document.querySelector(".semantic-search-input") as HTMLInputElement;
          if (input) {
            if (p > 0.85) {
              input.value = "Hard dynamic programming questions asked in Google SWE interviews";
              const box = document.querySelector(".semantic-search-box") as HTMLElement;
              if (box) {
                box.style.boxShadow = `0 0 25px 4px rgba(var(--foreground-rgb), 0.12)`;
                box.style.borderColor = "var(--foreground)";
                box.style.transform = "translateZ(-20px) scale(1.03)";
              }
            } else {
              input.value = "";
              const box = document.querySelector(".semantic-search-box") as HTMLElement;
              if (box) {
                box.style.boxShadow = "none";
                box.style.borderColor = "var(--border)";
                box.style.transform = "translateZ(-20px) scale(1)";
              }
            }
          }
        }
      }
    });

    // 6. Placement Sprints 3D Timeline Rolodex Spin
    const wheelObj = { rotation: 0 };
    const cardCount = sprintSchedules[activeSprintDuration].length;
    const finalRot = -((cardCount - 1) / cardCount) * 360;

    gsap.fromTo(wheelObj,
      { rotation: 0 },
      {
        rotation: finalRot,
        scrollTrigger: {
          trigger: sprintSectionRef.current,
          start: "top top",
          end: "bottom bottom",
          scrub: true,
          pin: true,
        },
        onUpdate: () => {
          const el = document.querySelector(".rolodex-wheel-3d") as HTMLElement;
          if (el) {
            el.style.setProperty("--wheel-rotation", `${wheelObj.rotation}deg`);
          }
        }
      }
    );

    // 7. Premium Pricing Monolith Rise & Scan
    const pricingTl = gsap.timeline({
      scrollTrigger: {
        trigger: pricingSectionRef.current,
        start: "top 80%",
        end: "bottom 20%",
        scrub: true,
      }
    });

    pricingTl.fromTo(".pricing-monolith-card",
      { "--monolith-y-num": 120 },
      { "--monolith-y-num": 0, ease: "power2.out" }
    )
    .fromTo(".pricing-standard-card",
      { filter: "grayscale(0) opacity(1)" },
      { filter: "grayscale(1) opacity(0.55)", ease: "none" },
      "<"
    )
    .fromTo(".pricing-laser-line",
      { top: "0%", opacity: 0 },
      { top: "100%", opacity: 0.8, ease: "power1.inOut" },
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
            <span className="font-bold block text-foreground">
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
          {/* 3D Macbook Viewport */}
          <div className="macbook-viewport perspective-1200 preserve-3d w-full max-w-4xl aspect-[16/10] flex items-center justify-center relative">
            <div className="macbook-container-3d preserve-3d w-[90%] aspect-[16/10] relative will-change-transform flex flex-col justify-end items-center transition-all duration-300 ease-out">
              
              {/* Screen Lid (3D Plane) */}
              <div 
                className="macbook-screen-lid preserve-3d origin-bottom w-full aspect-[16/10] bg-zinc-950 rounded-t-xl border border-zinc-800 p-2 absolute bottom-[8%] left-0 shadow-2xl flex flex-col will-change-transform"
                style={{ transform: "rotateX(-95deg)" }}
              >
                {/* Back Outer Shell */}
                <div 
                  className="absolute inset-0 bg-zinc-900 border border-zinc-800 rounded-t-xl backface-hidden" 
                  style={{ transform: "translateZ(-1px)" }}
                />
                
                {/* Screen bezel & content */}
                <div className="relative w-full h-full bg-background rounded-md overflow-hidden border border-zinc-800 flex flex-col pt-3">
                  {/* Top camera bezel */}
                  <div className="w-24 h-4 bg-zinc-950 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-md z-30 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                  </div>

                  {/* MacBook Screen Content (Parallax layers inside screen) */}
                  <div className="macbook-screen-content absolute inset-0 grid md:grid-cols-3 gap-px bg-border/20 pt-4">
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
                        ].map((item, idx) => (
                          <div
                            key={item.day}
                            className={`macbook-inner-card macbook-inner-card-${idx} flex items-center gap-4 py-4 px-5 rounded-xl border border-border/30 bg-surface/60 hover:border-foreground/10 hover:bg-surface-elevated/40 transition-all duration-300`}
                            style={{ transform: "translateZ(-80px)" }}
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
                </div>
              </div>

              {/* Keyboard Base (3D Plane) */}
              <div 
                className="macbook-keyboard-base preserve-3d origin-top w-full h-[15%] bg-zinc-900 border-x border-b border-zinc-800 rounded-b-xl shadow-xl absolute top-[92%] left-0 flex flex-col p-2"
                style={{ transform: "rotateX(75deg)" }}
              >
                {/* Keycap layout simulation */}
                <div className="w-full flex-1 grid grid-cols-12 gap-0.5 bg-zinc-950 p-1 rounded">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div key={i} className="keycap-3d bg-zinc-800 border-b border-zinc-950 rounded-[1px] h-2 opacity-60" />
                  ))}
                </div>
                {/* Trackpad */}
                <div className="w-24 h-4 mx-auto border border-zinc-800/60 bg-zinc-950 rounded mt-1 opacity-70" />
              </div>

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

          <div 
            className="md:col-span-7 flex flex-col items-center perspective-1000 preserve-3d"
            onMouseMove={(e) => {
              const el = e.currentTarget;
              const rect = el.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width - 0.5;
              const y = (e.clientY - rect.top) / rect.height - 0.5;
              const grid = el.querySelector(".heatmap-3d-grid-wrap") as HTMLElement;
              if (grid) {
                grid.style.transform = `rotateX(${55 - y * 15}deg) rotateY(0deg) rotateZ(${-35 + x * 15}deg)`;
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              const grid = el.querySelector(".heatmap-3d-grid-wrap") as HTMLElement;
              if (grid) {
                grid.style.transform = `rotateX(55deg) rotateY(0deg) rotateZ(-35deg)`;
              }
            }}
          >
            <ParallaxCard className="w-full" tilt={1}>
              <div className="glass-card p-6 border border-border/40 space-y-5 text-left font-mono preserve-3d">
                <div className="flex items-center justify-between border-b border-border/20 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${syncComplete ? "bg-success" : "bg-warning animate-pulse"}`} />
                    <span className="text-[11px] text-muted uppercase tracking-wider">
                      {syncComplete ? "Sync Complete" : "Syncing metrics..."}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted font-mono">{syncCount} / 1284 solved</span>
                </div>

                {/* Isometric Heatmap 3D Terrain */}
                <div className="flex justify-center items-center py-10 bg-surface/10 rounded-xl border border-border/10 overflow-visible relative min-h-[200px] preserve-3d">
                  <div 
                    className="heatmap-3d-grid-wrap preserve-3d grid grid-cols-20 gap-1.5 transition-transform duration-300 ease-out"
                    style={{
                      transform: "rotateX(55deg) rotateY(0deg) rotateZ(-35deg)",
                    }}
                  >
                    {Array.from({ length: 20 * 7 }).map((_, i) => {
                      const isActive = i % 7 === 0 || i % 5 === 0 || i % 3 === 0;
                      let bgShade = "bg-zinc-800/20 dark:bg-zinc-800/5";
                      if (isActive) {
                        if (i % 7 === 0) bgShade = "bg-zinc-50 dark:bg-white border-zinc-200";
                        else if (i % 5 === 0) bgShade = "bg-zinc-300 dark:bg-zinc-400 border-zinc-400";
                        else bgShade = "bg-zinc-500 dark:bg-zinc-600 border-zinc-600";
                      }
                      
                      return (
                        <div 
                          key={i} 
                          className="heatmap-block-3d preserve-3d relative w-4.5 h-4.5 rounded-[1px] shadow-sm transition-all duration-150 will-change-transform"
                          style={{ 
                            transform: "translateZ(0px)",
                            opacity: 0.2
                          }}
                        >
                          {/* Top Face */}
                          <div className={`absolute inset-0 border border-border/10 rounded-[1px] ${bgShade}`} />
                          {/* Front Skirt Face */}
                          <div 
                            className="absolute inset-x-0 bottom-0 h-4 bg-zinc-800/80 dark:bg-zinc-950/80 rounded-b-[1px] backface-hidden"
                            style={{ transform: "rotateX(-90deg)", transformOrigin: "bottom center" }}
                          />
                          {/* Side Skirt Face */}
                          <div 
                            className="absolute inset-y-0 right-0 w-4 bg-zinc-700/80 dark:bg-zinc-900/80 rounded-r-[1px] backface-hidden"
                            style={{ transform: "rotateY(90deg)", transformOrigin: "right center" }}
                          />
                        </div>
                      );
                    })}
                  </div>
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
          <div 
            className="md:col-span-7 relative flex items-center justify-center h-[340px] perspective-1000 preserve-3d"
            onMouseMove={(e) => {
              const el = e.currentTarget;
              const rect = el.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width - 0.5;
              const y = (e.clientY - rect.top) / rect.height - 0.5;
              const card = el.querySelector(".gauge-3d-card") as HTMLElement;
              if (card) {
                card.style.transform = `rotateY(${x * 20}deg) rotateX(${-y * 20}deg)`;
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              const card = el.querySelector(".gauge-3d-card") as HTMLElement;
              if (card) {
                card.style.transform = `rotateY(0deg) rotateX(0deg)`;
              }
            }}
          >
            {/* The actual 3D Gauge Card */}
            <div className="gauge-3d-card preserve-3d relative z-10 bg-surface/20 border border-border/20 p-8 rounded-full flex items-center justify-center shadow-2xl w-72 h-72 transition-transform duration-300 ease-out">
              
              {/* Concentric pings */}
              <div className="readiness-pulse-ring absolute rounded-full border border-foreground/20 pointer-events-none w-64 h-64 opacity-0 scale-50" />
              
              {/* Back Plate Layer (translateZ(-25px)) */}
              <div 
                className="absolute inset-4 rounded-full border border-border/10 bg-surface-elevated/40 flex items-center justify-center transform preserve-3d"
                style={{ transform: "translateZ(-25px)" }}
              >
                {/* Tech ticks */}
                <div className="absolute inset-2 border-2 border-dashed border-border/10 rounded-full animate-[spin_60s_linear_infinite] opacity-30" />
                <div className="absolute inset-6 border border-border/5 rounded-full" />
              </div>

              {/* Central Gauge Layer (translateZ(0px)) */}
              <svg 
                className="w-56 h-56 overflow-visible transform" 
                viewBox="0 0 200 200"
                style={{ transform: "translateZ(0px)" }}
              >
                {/* Scale Arc Background */}
                <path
                  d="M 40 160 A 80 80 0 1 1 160 160"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.3"
                />
                {/* Scale Arc Active */}
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
                {/* 3D Extruded Needle */}
                <g className="readiness-needle-group" style={{ transformOrigin: "100px 100px" }}>
                  <polygon
                    points="97,100 100,20 103,100"
                    fill="var(--foreground)"
                    className="shadow"
                  />
                  <circle cx="100" cy="100" r="7" fill="var(--foreground)" />
                  <circle cx="100" cy="100" r="3" fill="var(--background)" />
                </g>
              </svg>

              {/* Digital display */}
              <div 
                className="absolute text-center mt-6 transform"
                style={{ transform: "translateZ(15px)" }}
              >
                <span id="readiness-score-val" className="text-4xl font-semibold tracking-tight text-foreground font-mono">0%</span>
                <span className="text-[10px] text-muted font-mono uppercase tracking-widest block mt-1">Readiness</span>
              </div>

              {/* Glass Glare Overlay (translateZ(30px)) */}
              <div 
                className="absolute inset-0 rounded-full border border-white/10 pointer-events-none transform"
                style={{
                  transform: "translateZ(30px)",
                  background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, transparent 60%)",
                }}
              />
            </div>

            {/* Radial Company Target tags */}
            {[
              { label: "Google", angle: -30, tx: -90, ty: -110 },
              { label: "Meta", angle: 45, tx: 110, ty: -60 },
              { label: "Stripe", angle: -135, tx: -110, ty: 70 },
              { label: "Uber", angle: 120, tx: 90, ty: 90 },
            ].map((tag, i) => (
              <span
                key={i}
                className="readiness-company-tag absolute px-3 py-1 border border-border/30 bg-surface/90 rounded-full text-[10px] font-mono text-muted uppercase tracking-wider shadow-lg opacity-0 transform pointer-events-none"
                data-tx={tag.tx}
                data-ty={tag.ty}
                style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%) translateZ(40px)" }}
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
              AI Problem Assistant <span className="font-semibold block">IDE Workspace Prism</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Rotate your workspace container to resolve complex state transitions. Watch code, debugging traces, and optimization metrics spin into perspective seamlessly.
            </p>
          </div>

          {/* 3D Prism Workspace (Right) */}
          <div 
            className="md:col-span-7 relative h-[400px] w-full flex items-center justify-center perspective-1200 preserve-3d"
            onMouseMove={(e) => {
              const el = e.currentTarget;
              const rect = el.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width - 0.5;
              const y = (e.clientY - rect.top) / rect.height - 0.5;
              const prism = el.querySelector(".prism-container-3d") as HTMLElement;
              if (prism) {
                prism.style.setProperty("--mx-tilt", `${x * 12}deg`);
                prism.style.setProperty("--my-tilt", `${-y * 12}deg`);
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              const prism = el.querySelector(".prism-container-3d") as HTMLElement;
              if (prism) {
                prism.style.setProperty("--mx-tilt", "0deg");
                prism.style.setProperty("--my-tilt", "0deg");
              }
            }}
          >
            {/* The rotating prism itself */}
            <div 
              className="prism-container-3d preserve-3d relative w-[340px] h-[340px] will-change-transform transition-all duration-300 ease-out"
              style={{
                transform: "rotateX(var(--my-tilt, 0deg)) rotateY(calc(var(--prism-rotation, 0deg) + var(--mx-tilt, 0deg)))",
              }}
            >
              {/* Face A (0deg): Code Editor */}
              <div 
                className="cube-face preserve-3d bg-surface border border-border/40 rounded-2xl p-5 shadow-2xl flex flex-col justify-between"
                style={{
                  transform: "rotateY(0deg) translateZ(105px)",
                  backfaceVisibility: "hidden",
                }}
              >
                <div className="flex items-center gap-1.5 pb-2 border-b border-border/10 mb-3 font-mono text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-border" />
                  <span className="text-muted">solution.py</span>
                </div>
                <pre className="text-muted text-[10px] space-y-1 font-mono text-left overflow-hidden flex-1">
                  <code className="copilot-code-line block"><span className="text-foreground">def</span> <span className="text-muted">minDistance</span>(s1, s2):</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;m, n = len(s1), len(s2)</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;dp = [[0] * (n + 1) <span className="text-foreground">for</span> _ <span className="text-foreground">in</span> range(m + 1)]</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;<span className="text-foreground">for</span> i <span className="text-foreground">in</span> range(m + 1): dp[i][0] = i</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;<span className="text-foreground">for</span> j <span className="text-foreground">in</span> range(n + 1): dp[0][j] = j</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;<span className="text-foreground">for</span> i <span className="text-foreground">in</span> range(1, m + 1):</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-foreground">for</span> j <span className="text-foreground">in</span> range(1, n + 1):</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-foreground">if</span> s1[i-1] == s2[j-1]:</code>
                  <code className="copilot-code-line block">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;dp[i][j] = dp[i-1][j-1]</code>
                </pre>
              </div>

              {/* Face B (120deg): AI Copilot Explanation */}
              <div 
                className="cube-face preserve-3d bg-surface border border-border/40 rounded-2xl p-5 shadow-2xl flex flex-col justify-between"
                style={{
                  transform: "rotateY(120deg) translateZ(105px)",
                  backfaceVisibility: "hidden",
                }}
              >
                <div className="flex items-center gap-1.5 pb-2 border-b border-border/10 mb-3 text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-foreground/75" />
                  AI Debugger
                </div>
                <div className="space-y-3 flex-1 text-left font-sans text-xs">
                  <div className="copilot-msg p-3 bg-surface-elevated/40 border border-border/20 rounded-xl">
                    <span className="text-[8px] font-mono text-muted uppercase tracking-wider block mb-1">Trace analysis</span>
                    <p className="text-[11px] text-foreground font-light leading-relaxed">
                      Edit Distance matches cells. Deleting a character maps to <span className="font-mono text-foreground font-semibold">dp[i-1][j] + 1</span>.
                    </p>
                  </div>
                  <div className="copilot-msg p-3 bg-surface-elevated/40 border border-border/20 rounded-xl font-mono">
                    <span className="text-[8px] text-muted uppercase tracking-wider block mb-1">Complexity</span>
                    <p className="text-[11px] text-foreground font-medium">Time: O(M * N) | Space: O(M * N)</p>
                  </div>
                </div>
              </div>

              {/* Face C (240deg): Performance Diagnostic Visual */}
              <div 
                className="cube-face preserve-3d bg-surface border border-border/40 rounded-2xl p-5 shadow-2xl flex flex-col justify-between"
                style={{
                  transform: "rotateY(240deg) translateZ(105px)",
                  backfaceVisibility: "hidden",
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/10 mb-3 text-xs font-mono font-semibold uppercase tracking-wider text-foreground">
                  <span>Trace Table</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                </div>
                
                <div className="flex-1 flex flex-col justify-center space-y-2 text-left font-mono text-[9px] text-muted">
                  <div className="grid grid-cols-5 gap-1 text-center font-bold text-foreground/60 border-b border-border/10 pb-1">
                    <span>dp</span><span>""</span><span>"c"</span><span>"a"</span><span>"t"</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <span className="font-bold text-foreground/60">""</span><span className="text-success">0</span><span>1</span><span>2</span><span>3</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    <span className="font-bold text-foreground/60">"c"</span><span>1</span><span className="text-success">0</span><span>1</span><span>2</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center animate-pulse">
                    <span className="font-bold text-foreground/60">"o"</span><span>2</span><span>1</span><span className="text-warning font-bold">1</span><span>2</span>
                  </div>
                  <p className="text-[9px] text-center text-muted/80 pt-2 font-sans font-light">Dynamic matrix calculation resolved successfully.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── FEATURE SECTION 4: SEMANTIC FILTER SEARCH ─────────── */}
      <section ref={semanticSectionRef} className="relative z-10 px-6 py-28 bg-surface/5 scroll-reveal-container">
        <div className="max-w-5xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          
          {/* Orbital Gravity Vortex display */}
          <div 
            className="md:col-span-7 order-2 md:order-1 relative flex items-center justify-center h-[320px] perspective-1000 preserve-3d"
            onMouseMove={(e) => {
              const el = e.currentTarget;
              const rect = el.getBoundingClientRect();
              const x = (e.clientX - rect.left) / rect.width - 0.5;
              const y = (e.clientY - rect.top) / rect.height - 0.5;
              const vortex = el.querySelector(".vortex-wrap-3d") as HTMLElement;
              if (vortex) {
                vortex.style.transform = `rotateY(${x * 25}deg) rotateX(${-y * 25}deg)`;
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              const vortex = el.querySelector(".vortex-wrap-3d") as HTMLElement;
              if (vortex) {
                vortex.style.transform = `rotateY(0deg) rotateX(0deg)`;
              }
            }}
          >
            <div className="vortex-wrap-3d preserve-3d relative w-full max-w-sm h-full flex items-center justify-center transition-transform duration-300 ease-out">
              {/* 3D Funnel rings background */}
              <div className="absolute inset-0 preserve-3d pointer-events-none flex items-center justify-center">
                {[40, 80, 120, 160, 200].map((radius, idx) => (
                  <div
                    key={idx}
                    className="absolute border border-dashed border-foreground/15 rounded-full"
                    style={{
                      width: `${radius * 2}px`,
                      height: `${radius * 2}px`,
                      transform: `translateZ(${-idx * 35}px)`,
                      opacity: 1 - idx * 0.18,
                    }}
                  />
                ))}
              </div>

              <div 
                className="semantic-search-box p-3 bg-surface/90 border border-border rounded-xl flex items-center z-10 relative transition-all duration-300 w-full transform shadow-2xl"
                style={{ transform: "translateZ(-20px)" }}
              >
                <Search className="h-4 w-4 text-muted ml-2" />
                <input
                  type="text"
                  disabled
                  className="semantic-search-input bg-transparent text-xs font-light text-foreground flex-1 ml-2 border-0 outline-none"
                  value=""
                />
              </div>

              {/* Outer floating orbital tags in 3D */}
              <div className="absolute inset-0 pointer-events-none overflow-visible preserve-3d">
                {[
                  { text: "Google Target", dx: -100, dy: -60, dz: 80, r: 40 },
                  { text: "Dynamic Programming", dx: 110, dy: -50, dz: -40, r: 50 },
                  { text: "Hard Difficulty", dx: -110, dy: 60, dz: 60, r: 35 },
                  { text: "Graph Search", dx: 110, dy: 50, dz: -60, r: 45 },
                  { text: "Staggered Orbit", dx: -10, dy: -80, dz: 20, r: 40 },
                ].map((tag, idx) => (
                  <span
                    key={idx}
                    className="semantic-floating-tag absolute px-3 py-1 rounded-full border border-border/30 bg-surface/90 text-[9px] font-mono text-muted whitespace-nowrap shadow-xl opacity-0 preserve-3d"
                    data-dx={tag.dx}
                    data-dy={tag.dy}
                    data-dz={tag.dz}
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
              Semantic AI Filter <span className="font-semibold block">Vortex Gravity Well</span>
            </h2>
            <p className="text-muted leading-relaxed font-light text-sm sm:text-[15px]">
              Type queries in conversational English. Floating target tags spin in 3D orbit before collapsing directly inside the input well to resolve search criteria.
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
                Placement Sprints <span className="font-semibold block">3D Timeline Rolodex</span>
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

            {/* 3D Cylindrical Rolodex Wheel */}
            <div 
              className="md:col-span-7 w-full h-[400px] relative flex items-center justify-center perspective-1200 preserve-3d"
              onMouseMove={(e) => {
                const el = e.currentTarget;
                const rect = el.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width - 0.5;
                const y = (e.clientY - rect.top) / rect.height - 0.5;
                const wheel = el.querySelector(".rolodex-wheel-3d") as HTMLElement;
                if (wheel) {
                  wheel.style.setProperty("--mx-tilt", `${x * 15}deg`);
                  wheel.style.setProperty("--my-tilt", `${-y * 15}deg`);
                }
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                const wheel = el.querySelector(".rolodex-wheel-3d") as HTMLElement;
                if (wheel) {
                  wheel.style.setProperty("--mx-tilt", "0deg");
                  wheel.style.setProperty("--my-tilt", "0deg");
                }
              }}
            >
              <div 
                className="rolodex-wheel-3d preserve-3d relative w-[340px] h-[220px] transition-transform duration-300 ease-out"
                style={{
                  transform: "rotateX(var(--my-tilt, 0deg)) rotateY(calc(var(--wheel-rotation, 0deg) + var(--mx-tilt, 0deg)))",
                }}
              >
                {sprintSchedules[activeSprintDuration].map((card, idx) => {
                  const total = sprintSchedules[activeSprintDuration].length;
                  const angle = (idx / total) * 360;
                  
                  return (
                    <div
                      key={idx}
                      className="sprint-rolodex-card absolute inset-0 bg-surface border border-border rounded-2xl shadow-xl flex flex-col justify-between p-6 backface-hidden preserve-3d"
                      style={{
                        transform: `rotateY(${angle}deg) translateZ(280px)`,
                        backfaceVisibility: "hidden",
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
                  );
                })}
              </div>
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

            {/* Premium pricing card (3D Monolith) */}
            <div className="pricing-monolith-container relative rounded-3xl overflow-visible perspective-1000 preserve-3d">
              <div 
                className="pricing-monolith-card preserve-3d bg-surface border border-border/45 rounded-3xl h-full relative will-change-transform shadow-2xl transition-transform duration-300 ease-out"
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  const rect = el.getBoundingClientRect();
                  const x = (e.clientX - rect.left) / rect.width - 0.5;
                  const y = (e.clientY - rect.top) / rect.height - 0.5;
                  el.style.transform = `rotateY(${x * 16}deg) rotateX(${-y * 16}deg) translate3d(0, calc(var(--monolith-y-num, 120) * 1px), 0)`;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget;
                  el.style.transform = `rotateY(0deg) rotateX(0deg) translate3d(0, calc(var(--monolith-y-num, 120) * 1px), 0)`;
                }}
                style={{
                  transform: "translate3d(0, calc(var(--monolith-y-num, 120) * 1px), 0)",
                }}
              >
                {/* 3D Extruded sides */}
                <div 
                  className="absolute w-[20px] top-[15px] bottom-[15px] -left-[10px] bg-zinc-800 border-l border-zinc-700/30 backface-hidden rounded-l" 
                  style={{ transformOrigin: "center left", transform: "rotateY(-90deg)" }}
                />
                <div 
                  className="absolute w-[20px] top-[15px] bottom-[15px] -right-[10px] bg-zinc-850 border-r border-zinc-800/30 backface-hidden rounded-r"
                  style={{ transformOrigin: "center right", transform: "rotateY(90deg)" }}
                />

                {/* Scanner sweep beam line */}
                <div 
                  className="pricing-laser-line absolute left-0 right-0 h-0.5 opacity-0 pointer-events-none transform" 
                  style={{ 
                    transform: "translateZ(1px)",
                    background: "linear-gradient(90deg, transparent, rgba(var(--foreground-rgb), 0.25) 50%, transparent)" 
                  }}
                />
                
                {/* Metal shimmer overlay */}
                <div className="absolute inset-0 reflection-sweep rounded-3xl" />

                {/* Inner Content (on the front face translateZ(10px)) */}
                <div 
                  className="p-8 flex flex-col justify-between h-full relative transform preserve-3d"
                  style={{ transform: "translateZ(10px)" }}
                >
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
