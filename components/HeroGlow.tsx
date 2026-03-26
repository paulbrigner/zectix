"use client";

import { useEffect, useRef } from "react";

export function HeroGlow() {
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const spotlight = spotlightRef.current;
    if (!spotlight) return;

    const container = spotlight.closest(".landing") as HTMLElement | null;
    if (!container) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const tick = () => {
      currentX = lerp(currentX, targetX, 0.08);
      currentY = lerp(currentY, targetY, 0.08);
      spotlight.style.setProperty("--spot-x", `${currentX}px`);
      spotlight.style.setProperty("--spot-y", `${currentY}px`);
      raf = requestAnimationFrame(tick);
    };

    const handleMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      spotlight.style.opacity = "1";
    };

    const handleLeave = () => {
      spotlight.style.opacity = "0";
    };

    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseleave", handleLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="glow-field" aria-hidden="true">
      <div className="glow-orb glow-orb-1" />
      <div className="glow-orb glow-orb-2" />
      <div className="glow-orb glow-orb-3" />
      <div className="glow-orb glow-orb-4" />
      <div className="glow-spotlight" ref={spotlightRef} />
      <div className="glow-noise" />
    </div>
  );
}
