"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger globally
gsap.registerPlugin(ScrollTrigger);

const ScrollContext = createContext<Lenis | null>(null);

export function ScrollProvider({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    // Check if reduced motion is preferred
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      return;
    }

    // Initialize Lenis
    const lenisInstance = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // smooth exponential decelerate
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1.0,
      touchMultiplier: 1.2,
    });

    setLenis(lenisInstance);

    // Connect Lenis scroll events to GSAP ScrollTrigger updates
    lenisInstance.on("scroll", () => {
      ScrollTrigger.update();
    });

    // Synchronize GSAP ticker loop to Lenis RAF loop
    const updateGsap = (time: number) => {
      lenisInstance.raf(time * 1000); // Lenis expects milliseconds
    };
    gsap.ticker.add(updateGsap);

    // Disable GSAP lag smoothing to avoid sync lag/jitter
    gsap.ticker.lagSmoothing(0);

    // Initial ScrollTrigger refresh
    ScrollTrigger.refresh();

    return () => {
      lenisInstance.destroy();
      gsap.ticker.remove(updateGsap);
      setLenis(null);
    };
  }, []);

  return (
    <ScrollContext.Provider value={lenis}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScroll() {
  return useContext(ScrollContext);
}
