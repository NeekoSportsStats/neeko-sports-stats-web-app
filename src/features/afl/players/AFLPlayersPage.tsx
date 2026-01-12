import React, { useEffect, useState } from "react";

import RoundMomentumSection from "./sections/round-momentum/RoundMomentumSection";
import FormStabilitySection from "./sections/form-stability/FormStabilitySection";
import PositionTrendsSection from "./sections/position-trends/PositionTrendsSection";
import AIInsightsSection from "./sections/ai-insights/AIInsightsSection";
import MasterTableSection from "./sections/master-table/MasterTableSection";

export default function AFLPlayersPage() {
  const [activeSection, setActiveSection] = useState("round-momentum");
  const [isStuck, setIsStuck] = useState(false);
  const [showTopButton, setShowTopButton] = useState(false);

  useEffect(() => {
    const ids = [
      "round-momentum",
      "form-stability",
      "position-trends",
      "ai-insights",
      "master-table",
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.15, rootMargin: "-10% 0px -55% 0px" }
    );

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const anchor = document.getElementById("selector-bar");
    if (!anchor) return;

    const io = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 1 }
    );

    io.observe(anchor);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTopButton(window.scrollY > 600);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const sections = [
    { id: "round-momentum", label: "Round Momentum" },
    { id: "form-stability", label: "Form Stability" },
    { id: "position-trends", label: "Position Trends" },
    { id: "ai-insights", label: "AI Insights" },
    { id: "master-table", label: "Master Table" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-white">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          AFL Player Performance Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          League-wide momentum, form stability, role trends, AI projections and
          full-season player ledgers.
        </p>
      </header>

      <div id="selector-bar" className="h-1 w-full" />

      <div className={`sticky top-16 z-40 mb-12 ${isStuck ? "scale-[1.01]" : ""}`}>
        <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl px-4 py-3 shadow-lg">
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={
                  activeSection === s.id
                    ? "rounded-full bg-yellow-400 px-3.5 py-1.5 text-xs font-medium text-black shadow"
                    : "rounded-full bg-black/40 px-3.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
                }
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-24">
        <section id="round-momentum" className="scroll-mt-28">
          <RoundMomentumSection />
        </section>

        <section id="form-stability" className="scroll-mt-28">
          <FormStabilitySection />
        </section>

        <section id="position-trends" className="scroll-mt-28">
          <PositionTrendsSection />
        </section>

        <section id="ai-insights" className="scroll-mt-28">
          <AIInsightsSection />
        </section>

        <section id="master-table" className="scroll-mt-28">
          <MasterTableSection />
        </section>
      </div>

      {showTopButton && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 rounded-full bg-yellow-400 px-4 py-2 text-sm font-semibold text-black shadow-lg"
        >
          Back to Top
        </button>
      )}
    </div>
  );
}
