import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

export default function PlayerImpactMap() {
  return (
    <section
      className={cn(
        "relative rounded-3xl border border-yellow-500/20",
        "bg-gradient-to-br from-black via-[#050507] to-[#14100a]",
        "px-4 py-6 md:px-8 md:py-8",
        "shadow-[0_0_120px_rgba(0,0,0,0.7)] overflow-hidden",
        "animate-in fade-in slide-in-from-bottom-6"
      )}
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[480px] -translate-x-1/2 bg-yellow-500/20 blur-3xl" />

      <div className="relative">
        <div className="mb-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-yellow-400/30 bg-yellow-500/10 px-3.5 py-1.5 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-yellow-300" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-yellow-200">
              Player Impact Map
            </span>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Player Impact Map
          </h2>

          <p className="mt-2 text-sm text-white/70 leading-relaxed max-w-2xl">
            Cluster view: ceiling vs safety (coming next)
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm px-6 py-12 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-yellow-500/10 p-4 mb-4">
            <Sparkles className="h-8 w-8 text-yellow-400" />
          </div>
          <p className="text-white/60 text-sm">
            Advanced scatter visualization coming soon
          </p>
        </div>
      </div>
    </section>
  );
}
