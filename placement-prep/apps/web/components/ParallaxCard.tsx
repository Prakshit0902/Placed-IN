"use client";

import { useRef, useState, type ReactNode, type CSSProperties } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  tilt?: number;
}

export default function ParallaxCard({ children, className = "", tilt = 5 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({});

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    const rx = -(ny - 0.5) * tilt;
    const ry = (nx - 0.5) * tilt;
    setStyle({
      transform: `rotateX(${rx}deg) rotateY(${ry}deg)`,
      "--mx": `${nx * 100}%`,
      "--my": `${ny * 100}%`,
      "--glow": "1",
    } as CSSProperties);
  };

  const onLeave = () =>
    setStyle({ transform: "rotateX(0) rotateY(0)", "--glow": "0" } as CSSProperties);

  return (
    <div className={`parallax-card-wrap ${className}`}>
      <div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="parallax-card relative rounded-xl"
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
