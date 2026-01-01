import React from "react";

/**
 * STEP 1 PLACEHOLDER — Player Trend Modal
 *
 * This file is intentionally minimal.
 * It will be fully implemented in Step 3.
 *
 * For now:
 * - No data imports
 * - No projections
 * - No charts
 */

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function PlayerTrendModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0b] p-6">
        <h3 className="text-lg font-semibold text-white">
          Player Trend (Coming Soon)
        </h3>
        <p className="mt-2 text-sm text-white/60">
          Weekly trends, projections, and comparisons will appear here.
        </p>

        <button
          onClick={onClose}
          className="mt-4 rounded-full border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
        >
          Close
        </button>
      </div>
    </div>
  );
}
