import { useState, useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface PlayerOption {
  player_id: string;
  player_name: string;
  team: string | null;
  position: string | null;
  projection_final: number | null;
  neeko_rating: number | null;
}

interface StartSitSelectorProps {
  label: string;
  value: PlayerOption | null;
  excludeId?: string | null;
  onChange: (player: PlayerOption | null) => void;
}

export function StartSitSelector({ label, value, excludeId, onChange }: StartSitSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from("v_rankings_master")
        .select("player_id, player_name, team, position, projection_final, neeko_rating")
        .ilike("player_name", `%${query}%`)
        .not("player_id", "is", null)
        .order("neeko_rating", { ascending: false })
        .limit(12);
      setLoading(false);
      setResults((data ?? []).filter((p) => p.player_id !== excludeId) as PlayerOption[]);
    }, 220);
    return () => clearTimeout(timer);
  }, [query, excludeId]);

  function select(player: PlayerOption) {
    onChange(player);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function clear() {
    onChange(null);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative w-full">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35 mb-2">{label}</p>

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{value.player_name}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {value.team}{value.position ? ` · ${value.position}` : ""}
              {value.projection_final != null && (
                <span className="ml-2 text-[#F5C84C]/70">Proj {Math.round(value.projection_final)}</span>
              )}
            </p>
          </div>
          <button onClick={clear} className="shrink-0 text-white/30 hover:text-white/70 transition-colors">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            type="text"
            value={query}
            placeholder="Search player name..."
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-4 py-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
          />
        </div>
      )}

      {open && (query.length >= 2) && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden">
          {loading && (
            <div className="px-4 py-3 text-xs text-white/30">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="px-4 py-3 text-xs text-white/30">No players found</div>
          )}
          {results.map((p) => (
            <button
              key={p.player_id}
              onClick={() => select(p)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-0"
            >
              <div>
                <p className="text-sm font-semibold text-white">{p.player_name}</p>
                <p className="text-[10px] text-white/35">{p.team}{p.position ? ` · ${p.position}` : ""}</p>
              </div>
              {p.neeko_rating != null && (
                <span className="text-xs font-bold text-[#F5C84C]/70 tabular-nums">{Number(p.neeko_rating).toFixed(1)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
