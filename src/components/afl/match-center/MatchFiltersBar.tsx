
import React from "react";
import { Button } from "@/components/ui/button";

export type MatchCenterView = "today" | "thisRound" | "all";

type Props = {
  view: MatchCenterView;
  onChangeView: (v: MatchCenterView) => void;

  // Mobile ladder toggle
  ladderOpen?: boolean;
  onToggleLadder?: () => void;
};

export default function MatchFiltersBar({
  view,
  onChangeView,
  ladderOpen,
  onToggleLadder,
}: Props) {
  return (
    <div className="mb-5 md:mb-6">
      <div className="sticky top-3 z-20 rounded-xl border border-white/10 bg-black/60 p-2 backdrop-blur-xl md:static md:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-2">
            <Button size="sm" variant={view === "today" ? "default" : "secondary"} onClick={() => onChangeView("today")}>
              Today
            </Button>
            <Button size="sm" variant={view === "thisRound" ? "default" : "secondary"} onClick={() => onChangeView("thisRound")}>
              This Round
            </Button>
            <Button size="sm" variant={view === "all" ? "default" : "secondary"} onClick={() => onChangeView("all")}>
              All Fixtures
            </Button>
          </div>

          <div className="flex-1" />

          {/* Mobile ladder toggle */}
          {onToggleLadder && (
            <div className="md:hidden">
              <Button
                size="sm"
                variant="ghost"
                onClick={onToggleLadder}
                aria-expanded={!!ladderOpen}
              >
                {ladderOpen ? "Hide ladder" : "Show ladder"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
