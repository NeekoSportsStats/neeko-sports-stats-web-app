import { Crown, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { NEEKO_PRICING } from "@/config/neekoPricing";
import { MarketRow } from "./types";
import { MarketPlayerCard, LockedMarketCard } from "./MarketPlayerCard";
import { FREE_VISIBLE } from "./helpers";

interface Props {
  title: string;
  description: string;
  rows: MarketRow[];
  loading: boolean;
  tab: string;
  icon: React.ReactNode;
  accentClass: string;
  isPremium: boolean;
  onShowUpgrade: () => void;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 animate-pulse">
      <div className="flex gap-2 mb-3">
        <div className="w-5 h-3 bg-white/10 rounded" />
        <div className="flex-1 h-3 bg-white/10 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0,1,2].map(i => <div key={i} className="h-10 bg-white/5 rounded-lg" />)}
      </div>
    </div>
  );
}

export function MarketSection({
  title,
  description,
  rows,
  loading,
  tab,
  icon,
  accentClass,
  isPremium,
  onShowUpgrade,
}: Props) {
  const visibleFree = FREE_VISIBLE;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentClass}`}>
              {icon}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{title}</h3>
              <p className="text-[11px] text-white/35 mt-0.5">{description}</p>
            </div>
          </div>
          {!isPremium && (
            <div className="shrink-0">
              <span className="text-[10px] text-white/30 bg-white/5 border border-white/10 px-2 py-1 rounded-full">
                Free: top {visibleFree}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {loading
          ? [0,1,2].map(i => <SkeletonCard key={i} />)
          : rows.length === 0
          ? (
            <div className="col-span-full flex items-center justify-center py-10 text-white/30 text-sm">
              No players found in this category right now.
            </div>
          )
          : rows.map((row, idx) => {
              const rank = idx + 1;
              const locked = !isPremium && rank > visibleFree;
              return locked ? (
                <LockedMarketCard key={idx} rank={rank} onUnlock={onShowUpgrade} />
              ) : (
                <MarketPlayerCard key={row.player_id ?? idx} row={row} tab={tab} rank={rank} />
              );
            })
        }
      </div>
    </div>
  );
}
