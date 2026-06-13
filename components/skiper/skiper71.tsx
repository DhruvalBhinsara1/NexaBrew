"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
} from "framer-motion";
import { Coffee, ChevronDown } from "lucide-react";

const IMAGES = ["/coffee_pour.png", "/cafe_interior.png", "/coffee_beans.png"];

const SECTIONS = [
  {
    title: "Run your cafe, end to end.",
    description:
      "Orders, kitchen display, payments, and reporting — one fast, real-time system for admins, staff, and customers.",
    bullets: [
      "Real-time kitchen display",
      "Razorpay & cash payments",
      "Live sales reporting",
    ],
  },
  {
    title: "Real-time KDS coordination.",
    description:
      "No more lost paper tickets. Orders sync instantly to the kitchen display. Track ticket status and complete items on the fly.",
    bullets: [
      "Instant ticket dispatch",
      "Real-time order updates",
      "Optimized cooking flows",
    ],
  },
  {
    title: "Live sales and analytics.",
    description:
      "Track performance metrics, cash drawer balance, top products sold, and employee sales with detailed report dashboards.",
    bullets: [
      "Revenue & payment analysis",
      "Interactive table occupancy",
      "Detailed shift sessions",
    ],
  },
];

/* ── Thresholds with hysteresis to prevent jitter at boundaries ── */
function getSectionFromProgress(progress: number, current: number): number {
  // Going UP (forward): switch later
  // Going DOWN (backward): switch earlier
  // This prevents rapid toggling at boundary
  if (current === 0) {
    if (progress >= 0.38) return 1;
    return 0;
  }
  if (current === 1) {
    if (progress >= 0.72) return 2;
    if (progress < 0.28) return 0;
    return 1;
  }
  // current === 2
  if (progress < 0.62) return 1;
  return 2;
}

export function Skiper71(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef(0);
  const [activeSection, setActiveSection] = useState(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { scrollYProgress } = useScroll({ container: containerRef });

  /* ── Image clip-path reveals ── */
  const clipPath2 = useTransform(
    scrollYProgress,
    [0.2, 0.45],
    ["inset(100% 0 0 0)", "inset(0% 0 0 0)"]
  );
  const clipPath3 = useTransform(
    scrollYProgress,
    [0.55, 0.82],
    ["inset(100% 0 0 0)", "inset(0% 0 0 0)"]
  );

  /* ── Image brightness transitions ── */
  const filter1 = useTransform(
    scrollYProgress,
    [0, 0.25, 0.42],
    [
      "brightness(0.38) saturate(1.1)",
      "brightness(0.38) saturate(1.1)",
      "brightness(0.12) saturate(0.6)",
    ]
  );
  const filter2 = useTransform(
    scrollYProgress,
    [0.15, 0.42, 0.55, 0.82],
    [
      "brightness(0.12) saturate(0.6)",
      "brightness(0.38) saturate(1.1)",
      "brightness(0.38) saturate(1.1)",
      "brightness(0.12) saturate(0.6)",
    ]
  );
  const filter3 = useTransform(
    scrollYProgress,
    [0.55, 0.82, 1],
    [
      "brightness(0.12) saturate(0.6)",
      "brightness(0.38) saturate(1.1)",
      "brightness(0.38) saturate(1.1)",
    ]
  );

  /* ── Debounced section updater ── */
  const updateSection = useCallback((next: number) => {
    if (next !== sectionRef.current) {
      sectionRef.current = next;
      setActiveSection(next);
    }
  }, []);

  /* ── Scroll-driven section tracking with hysteresis ── */
  useEffect(() => {
    const unsub = scrollYProgress.on("change", (latest) => {
      const next = getSectionFromProgress(latest, sectionRef.current);
      updateSection(next);
    });
    return unsub;
  }, [scrollYProgress, updateSection]);

  /* ── Start / reset the 5-second auto-advance timer ── */
  const resetAutoTimer = useCallback(() => {
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const total = container.scrollHeight - container.clientHeight;
      const next = (sectionRef.current + 1) % 3;
      const targets = [0, total * 0.5, total];
      container.scrollTo({ top: targets[next], behavior: "smooth" });
    }, 5000);
  }, []);

  /* ── Detect user interaction → reset auto timer ── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onUser = () => {
      // Debounce: only reset timer after user stops scrolling for 200ms
      if (userTimerRef.current) clearTimeout(userTimerRef.current);
      userTimerRef.current = setTimeout(() => resetAutoTimer(), 200);
    };

    container.addEventListener("wheel", onUser, { passive: true });
    container.addEventListener("touchstart", onUser, { passive: true });
    container.addEventListener("pointerdown", onUser, { passive: true });

    return () => {
      container.removeEventListener("wheel", onUser);
      container.removeEventListener("touchstart", onUser);
      container.removeEventListener("pointerdown", onUser);
      if (userTimerRef.current) clearTimeout(userTimerRef.current);
    };
  }, [resetAutoTimer]);

  /* ── Restart auto timer whenever the active section settles ── */
  useEffect(() => {
    resetAutoTimer();
    return () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    };
  }, [activeSection, resetAutoTimer]);

  const sec = SECTIONS[activeSection];

  return (
    <div className="relative h-screen w-full overflow-hidden bg-zinc-950">
      {/* ── Image stack (fixed within panel) ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${IMAGES[0]})`, filter: filter1 }}
        />
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${IMAGES[1]})`,
            clipPath: clipPath2,
            filter: filter2,
          }}
        />
        <motion.div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${IMAGES[2]})`,
            clipPath: clipPath3,
            filter: filter3,
          }}
        />
      </div>

      {/* ── Gradient overlays ── */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-zinc-950/80 via-transparent to-zinc-950/50" />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-zinc-950/30 via-transparent to-transparent" />

      {/* ── Fixed content overlay ── */}
      <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-between p-10">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Coffee className="h-6 w-6 text-brand-400" />
          <span className="text-lg font-bold tracking-tight text-white">
            NexaBrew
          </span>
          <span className="rounded-full border border-brand-500/30 bg-brand-500/20 px-2 py-0.5 text-[10px] font-medium text-brand-300">
            POS Platform
          </span>
        </div>

        {/* Only ONE section visible at a time — mode="wait" prevents overlap */}
        <div className="relative min-h-[220px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="absolute inset-x-0 max-w-md"
            >
              <h2 className="text-3xl font-extrabold leading-tight text-white drop-shadow-lg">
                {sec.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                {sec.description}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-zinc-200">
                {sec.bullets.map((b) => (
                  <li key={b} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full border border-brand-500/40 bg-brand-500/25 text-[10px] font-bold text-brand-400">
                      ✓
                    </span>
                    <span className="font-medium">{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-white/40">
          <p>© NexaBrew — Cafe POS &amp; Management</p>
          <div className="flex items-center gap-1 text-brand-400">
            <span className="animate-bounce">
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
            <span className="text-[11px]">Scroll to explore</span>
          </div>
        </div>
      </div>

      {/* ── Invisible scroll driver ── */}
      <div
        ref={containerRef}
        className="absolute inset-0 z-[3] overflow-y-auto scrollbar-hide"
      >
        <div className="h-[400vh]" />
      </div>

      {/* ── Section dots ── */}
      <div className="absolute right-5 top-1/2 z-[4] flex -translate-y-1/2 flex-col items-center gap-3">
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            aria-label={`Go to section ${i + 1}`}
            className={`h-2.5 w-2.5 rounded-full border transition-all duration-300 ${
              i === activeSection
                ? "scale-125 border-brand-400 bg-brand-500"
                : "border-white/20 bg-white/10 hover:bg-white/20"
            }`}
            onClick={() => {
              const container = containerRef.current;
              if (!container) return;
              const total = container.scrollHeight - container.clientHeight;
              container.scrollTo({
                top: [0, total * 0.5, total][i],
                behavior: "smooth",
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}
