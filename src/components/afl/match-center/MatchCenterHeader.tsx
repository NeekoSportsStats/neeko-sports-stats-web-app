import React from "react";
import { cx } from "./utils";

type Props = {
  title?: string;
  subtitle?: string;
};

export default function MatchCenterHeader({
  title = "Match Center",
  subtitle = "Schedule + context. Deeper insights live on the AI page.",
}: Props) {
  return (
    <div className="mb-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-1 text-sm md:text-base text-white/70">{subtitle}</p>
        </div>

        {/* Placeholder for future: live tickers / quick nav */}
        <div className={cx("hidden md:flex items-center gap-2")}>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            AFL
          </span>
          <span className="rounded-full border border-amber-300/15 bg-amber-300/10 px-3 py-1 text-xs text-amber-200">
            Neeko+ ready
          </span>
        </div>
      </div>
    </div>
  );
}
