export default function MatchDetailCTA() {
  return (
    <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-4">
      <div className="text-sm font-semibold text-white">
        Deeper Match Insights
      </div>
      <div className="text-xs text-white/60 mt-1">
        Full AI analysis lives on the AI page.
      </div>

      <a
        href="/sports/afl/ai-analysis"
        className="mt-4 inline-flex items-center justify-center w-full rounded-md bg-amber-400 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-300 transition"
      >
        Open AI Match Analysis →
      </a>
    </div>
  );
}
