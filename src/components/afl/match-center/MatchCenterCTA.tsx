import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  href?: string;
};

export default function MatchCenterCTA({
  href = "https://www.neekostats.com.au/sports/afl/ai-analysis",
}: Props) {
  return (
    <div className="rounded-2xl border border-amber-300/15 bg-amber-300/10 p-4 backdrop-blur-xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-amber-100">Want the full breakdown?</div>
          <div className="mt-1 text-xs text-amber-100/70">
            Match Center is schedule + context. Full interpretation lives on the AI Insights page.
          </div>
        </div>

        <a href={href} target="_blank" rel="noreferrer">
          <Button size="sm">Open AI Insights →</Button>
        </a>
      </div>
    </div>
  );
}
