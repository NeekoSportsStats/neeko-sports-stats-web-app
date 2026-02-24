import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Lock } from "lucide-react";

interface PremiumGateProps {
  children?: ReactNode;
  blur?: boolean;
  isLocked?: boolean;
}

export function PremiumGate({ children, blur = true, isLocked }: PremiumGateProps) {
  const { isPremium } = useAuth();

  const locked = isLocked !== undefined ? isLocked : !isPremium;

  if (!locked) {
    return <>{children}</>;
  }

  if (!children) {
    return <PremiumGateCTA />;
  }

  return (
    <div className="relative">
      {blur && (
        <div className="blur-sm pointer-events-none select-none">
          {children}
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-md rounded-xl">
        <PremiumGateCTA />
      </div>
    </div>
  );
}

export function PremiumGateCTA() {
  return (
    <div className="flex flex-col items-center gap-3 text-center px-4 py-2">
      <Lock className="h-5 w-5 text-[#F5C84C]/70" />
      <div>
        <p className="text-sm font-semibold text-white/80 mb-1">Neeko+ Exclusive</p>
        <p className="text-xs text-neutral-500 mb-3">Unlock full AI analysis for all players, teams and matches.</p>
      </div>
      <a
        href="https://www.neekostats.com.au/neeko-plus"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black bg-gradient-to-r from-[#F5C84C] to-[#D4A017] hover:brightness-110 transition text-sm"
      >
        Upgrade to Neeko+
      </a>
    </div>
  );
}
