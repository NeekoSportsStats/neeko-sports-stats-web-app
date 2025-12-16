import React from "react";
import { Button } from "@/components/ui/button";
import { cx } from "./utils";

export type MatchCenterView = "today" | "thisRound" | "all";

type Props = {
  view: MatchCenterView;
  onChangeView: (v: MatchCenterView) => void;

  // placeholders for future controls
  teamFilter?: string;
  onChangeTeamFilter?: (team: string) => void;
};

export default function MatchFiltersBar({
  view,
  onChangeView,
}: Props) {
  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={view === "today" ? "default" : "secondary"}
            size="sm"
            onClick={() => onChangeView("today")}
          >
            Today
          </Button>
          <Button
            variant={view === "thisRound" ? "default" : "secondary"}
            size="sm"
            onClick={() => onChangeView("thisRound")}
          >
            This Round
          </Button>
          <Button
            variant={view === "all" ? "default" : "secondary"}
            size="sm"
            onClick={() => onChangeView("all")}
          >
            All Fixtures
          </Button>
        </div>

        <div className="flex-1" />

        {/* PLACEHOLDER: team / venue filters */}
        <div className="hidden md:flex items-center gap-2">
          <div className={cx("rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70")}>
            Team filter (placeholder)
          </div>
          <div className={cx("rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70")}>
            Venue filter (placeholder)
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-white/50">
        Match Center stays light: schedule + ladder context. Full interpretation lives on the AI Insights page.
      </p>
    </div>
  );
}
