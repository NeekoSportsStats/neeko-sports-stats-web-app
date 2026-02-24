import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Lock } from "lucide-react";
import { FREE_PLAYERS_PER_TEAM } from "@/config/freemiumConfig";

interface PlayerProjection {
  player_id: number;
  player_name: string;
  team: string;
  final_projection: number | null;
}

interface PlayerSelectorDropdownProps {
  teamName: string;
  players: PlayerProjection[];
  isPremium: boolean;
  loading: boolean;
  onSelect: (player: PlayerProjection) => void;
}

export default function PlayerSelectorDropdown({
  teamName,
  players,
  isPremium,
  loading,
  onSelect,
}: PlayerSelectorDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sorted = [...players].sort(
    (a, b) => (b.final_projection ?? 0) - (a.final_projection ?? 0)
  );

  const freeCount = FREE_PLAYERS_PER_TEAM;
  const freePlayers = sorted.slice(0, freeCount);
  const lockedPlayers = sorted.slice(freeCount);

  const canViewAll = isPremium;

  function handleSelect(player: PlayerProjection, isLocked: boolean) {
    if (isLocked) return;
    onSelect(player);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
          open
            ? "border-[#F5C84C]/50 bg-[#0f0f0f] text-white"
            : "border-white/10 bg-white/5 text-white/70 hover:border-white/25 hover:text-white"
        }`}
      >
        <span>Select {teamName} Player</span>
        <ChevronDown
          className={`h-4 w-4 text-neutral-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-[#2a2a2a] bg-[#0b0b0b] overflow-hidden"
          style={{ boxShadow: "0 0 0 1px rgba(245,200,76,0.1), 0 20px 60px rgba(0,0,0,0.9)" }}
        >
          {loading ? (
            <div className="px-4 py-5 text-center text-xs text-neutral-500 animate-pulse">
              Loading players...
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {freePlayers.map((player) => (
                <button
                  key={player.player_id}
                  onClick={() => handleSelect(player, false)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-[#F5C84C]/40"
                >
                  <span className="text-sm font-semibold text-white">{player.player_name}</span>
                  {player.final_projection != null && (
                    <span className="text-xs text-[#F5C84C] font-medium ml-3 flex-shrink-0">
                      {Number(player.final_projection).toFixed(0)} proj.
                    </span>
                  )}
                </button>
              ))}

              {lockedPlayers.length > 0 && (
                <>
                  <div className="px-4 py-2 border-t border-white/8">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                      Neeko+ Required
                    </span>
                  </div>
                  {lockedPlayers.map((player) => {
                    const isLocked = !canViewAll;
                    return isLocked ? (
                      <div
                        key={player.player_id}
                        className="w-full flex items-center justify-between px-4 py-3 text-left opacity-50 cursor-default"
                      >
                        <span className="text-sm font-medium text-white/60">{player.player_name}</span>
                        <span className="inline-flex items-center gap-1 text-xs text-[#F5C84C]/60 font-medium flex-shrink-0 ml-3">
                          <Lock className="h-3 w-3" />
                          Neeko+
                        </span>
                      </div>
                    ) : (
                      <button
                        key={player.player_id}
                        onClick={() => handleSelect(player, false)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-[#F5C84C]/40"
                      >
                        <span className="text-sm font-semibold text-white">{player.player_name}</span>
                        {player.final_projection != null && (
                          <span className="text-xs text-[#F5C84C] font-medium ml-3 flex-shrink-0">
                            {Number(player.final_projection).toFixed(0)} proj.
                          </span>
                        )}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
