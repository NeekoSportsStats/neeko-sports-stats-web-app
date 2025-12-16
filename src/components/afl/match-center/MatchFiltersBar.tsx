
import React from "react";
import { Button } from "@/components/ui/button";

export type MatchCenterView = "today" | "thisRound" | "all";

type Props = {
  view: MatchCenterView;
  onChangeView: (v: MatchCenterView) => void;
};

export default function MatchFiltersBar({ view, onChangeView }: Props) {
  return (
    <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-2 backdrop-blur-xl">
      <div className="flex gap-2">
        <Button size="sm" variant={view === "today" ? "default" : "secondary"} onClick={() => onChangeView("today")}>Today</Button>
        <Button size="sm" variant={view === "thisRound" ? "default" : "secondary"} onClick={() => onChangeView("thisRound")}>This Round</Button>
        <Button size="sm" variant={view === "all" ? "default" : "secondary"} onClick={() => onChangeView("all")}>All Fixtures</Button>
      </div>
    </div>
  );
}
