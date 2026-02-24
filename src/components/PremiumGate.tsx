import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Lock } from "lucide-react";

interface PremiumGateProps {
  children?: ReactNode;
  isLocked?: boolean;
  mode?: "blur" | "solid";
  blur?: boolean;
}

export function PremiumGate({ children, isLocked, mode = "solid", blur }: PremiumGateProps) {
  const { isPremium } = useAuth();

  const locked = isLocked !== undefined ? isLocked : !isPremium;

  if (!locked) {
    return <>{children}</>;
  }

  if (!children) {
    return <PremiumGateCTA />;
  }

  return (
    <div className="relative rounded-xl overflow-hidden">
      <div className="invisible pointer-events-none select-none">
        {children}
      </div>
      <div
        className="absolute inset-0 flex items-center justify-center rounded-xl"
        style={{
          background: "linear-gradient(180deg, rgba(245,200,76,0.08) 0%, rgba(245,200,76,0.04) 100%)",
          border: "1px solid rgba(245,200,76,0.35)",
          boxShadow: "0 0 25px rgba(245,200,76,0.18)",
        }}
      >
        <PremiumGateCTA />
      </div>
    </div>
  );
}

export function PremiumGateCTA() {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4 py-2">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "rgba(245,200,76,0.12)", border: "1px solid rgba(245,200,76,0.3)" }}
      >
        <Lock className="h-5 w-5 text-[#F5C84C]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-1">Neeko+ Exclusive</p>
        <p className="text-xs text-neutral-500 mb-3 max-w-[220px]">
          Unlock full AI analysis for all players, teams and matches.
        </p>
      </div>
      <a
        href="https://www.neekostats.com.au/neeko-plus"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-black bg-[#F5C84C] hover:bg-[#ffd95a] transition-colors text-sm"
      >
        Upgrade to Neeko+
      </a>
    </div>
  );
}
