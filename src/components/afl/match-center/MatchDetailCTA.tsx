import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MatchDetailCTA() {
  return (
    <div className="rounded-xl border border-amber-300/20 bg-gradient-to-br from-amber-400/10 to-transparent p-4">
      <div className="text-sm font-semibold text-white">
        Deeper Match Insights
      </div>

      <div className="mt-1 text-xs text-white/60">
        Full AI analysis lives on the AI page.
      </div>

      <Button
        className="mt-3 w-full bg-amber-400/90 text-black hover:bg-amber-400"
        size="sm"
      >
        Open AI Match Analysis
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
