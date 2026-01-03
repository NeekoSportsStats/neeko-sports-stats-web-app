import React from "react";
import { Lock, Sparkles, LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  rightSlot?: React.ReactNode;
  badge?: "neeko+" | "free" | undefined;
  pillLabel?: string;
  icon?: LucideIcon;
}

export function SectionHeader(props: SectionHeaderProps) {
  const { title, subtitle, description, rightSlot, badge, pillLabel, icon: Icon = Sparkles } = props;

  return (
    <div className="mb-5 md:mb-7">
      {pillLabel && (
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-black/70 px-3 py-1 text-xs text-yellow-200/90 mb-2">
          <Icon className="h-3.5 w-3.5 text-yellow-300" />
          <span className="uppercase tracking-[0.18em]">{pillLabel}</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl tracking-tight">{title}</h2>
            {badge === "neeko+" && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
                <Lock className="h-3 w-3" />
                Neeko+
              </div>
            )}
            {badge === "free" && (
              <div className="inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Free
              </div>
            )}
          </div>
          {subtitle && (
            <p className="mt-2 text-xs md:text-sm font-medium text-yellow-300/80">{subtitle}</p>
          )}
          {description && (
            <p className="mt-3 text-sm md:text-[15px] text-white/70 max-w-2xl">{description}</p>
          )}
        </div>

        {rightSlot && (
          <div className="flex items-center gap-2 flex-wrap">{rightSlot}</div>
        )}
      </div>
    </div>
  );
}
