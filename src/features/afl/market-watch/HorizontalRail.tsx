import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface Props {
  id?: string;
  label: string;
  labelColor: string;
  dot: string;
  description: string;
  children: ReactNode;
  count?: number;
  className?: string;
}

export function HorizontalRail({
  id,
  label,
  labelColor,
  dot,
  description,
  children,
  count,
  className = "",
}: Props) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = railRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    checkScroll();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkScroll); ro.disconnect(); };
  }, []);

  return (
    <section id={id} className={`mb-8 ${className}`}>
      <div className="px-1 mb-3">
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
          <h2 className={`text-sm font-bold ${labelColor}`}>{label}</h2>
          {count != null && count > 0 && (
            <ChevronRight className="h-3.5 w-3.5 text-white/15" />
          )}
          {count != null && count > 0 && (
            <span className="text-[10px] text-white/20 font-semibold">{count}</span>
          )}
        </div>
        <p className="text-[11px] text-white/30 pl-3.5 mt-0.5">{description}</p>
      </div>

      <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
        {canScrollLeft && (
          <div
            className="absolute left-0 top-0 bottom-0 w-10 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to right, rgba(10,10,10,0.9) 0%, transparent 100%)" }}
          />
        )}
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
            style={{ background: "linear-gradient(to left, rgba(10,10,10,0.9) 0%, transparent 100%)" }}
          />
        )}

        <div
          ref={railRef}
          className="flex overflow-x-auto gap-3 px-4 py-4 pb-5"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
