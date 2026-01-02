import React from "react";
import { Sparkles, LucideIcon } from "lucide-react";

interface SectionHeaderProps {
  pillLabel: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
}

export function SectionHeader({
  pillLabel,
  title,
  subtitle,
  description,
  icon: Icon = Sparkles,
}: SectionHeaderProps) {
  return (
    <div className="mb-5 md:mb-7">
      <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/40 bg-black/70 px-3 py-1 text-xs text-yellow-200/90 mb-2">
        <Icon className="h-3.5 w-3.5 text-yellow-300" />
        <span className="uppercase tracking-[0.18em]">{pillLabel}</span>
      </div>

      <div className="flex flex-row items-center gap-2">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>

      {subtitle && (
        <p className="mt-2 text-xs md:text-sm font-medium text-yellow-300/80">
          {subtitle}
        </p>
      )}

      {description && (
        <p className="mt-3 text-sm md:text-[15px] text-white/70 max-w-2xl">
          {description}
        </p>
      )}
    </div>
  );
}
