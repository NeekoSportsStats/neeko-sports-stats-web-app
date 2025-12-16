
import React from "react";
import { Button } from "@/components/ui/button";

export default function MatchCenterCTA() {
  return (
    <div className="mt-6 rounded-xl border border-amber-300/20 bg-gradient-to-r from-amber-300/10 to-amber-300/5 p-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-100">
            Ready for deeper match insight?
          </div>
          <div className="text-xs text-amber-100/70 mt-1">
            Full interpretation lives on the AI Insights page.
          </div>
        </div>
        <a href="/sports/afl/ai-analysis">
          <Button size="sm">Open AI Insights →</Button>
        </a>
      </div>
    </div>
  );
}
