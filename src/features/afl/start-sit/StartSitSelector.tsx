import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface PlayerOption {
  player_id: string;
  player_name: string;
  team: string | null;
  position: string | null;
  player_pos?: string | null;
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setActiveIndex(-1);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase.rpc("search_available_players", {
        p_query: query,
        p_limit: 12,
      });
      setLoading(false);
      setActiveIndex(-1);
      const mapped = ((data ?? []) as any[]).map((p) => ({
        player_id: p.player_id,
        player_name: p.player_name,
        team: p.team ?? null,
        position: p.player_pos ?? null,
        projection_final: p.projection_final != null ? Number(p.projection_final) : null,
        neeko_rating: p.neeko_rating != null ? Number(p.neeko_rating) : null,
      }));
      setResults(mapped.filter((p) => p.player_id !== excludeId));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, excludeId]);

  const select = useCallback((player: PlayerOption) => {
    onChange(player);
    setQuery("");
    setResults([]);
    setOpen(false);
    setActiveIndex(-1);
  }, [onChange]);

  function clear() {
    onChange(null);
    setQuery("");
    setResults([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const showDropdown = open && query.length >= 2;

  return (
    <div ref={containerRef} className="relative w-full">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-white/35 mb-2">{label}</p>

      {value ? (
        <button
          onClick={clear}
          className="w-full flex items-center justify-between gap-3 rounded-xl border border-[#F5C84C]/20 bg-[#F5C84C]/[0.04] px-4 py-3.5 text-left transition-colors hover:border-[#F5C84C]/30 group"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white truncate">{value.player_name}</p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {[value.team, value.position].filter(Boolean).join(" · ")}
              {value.projection_final != null && (
                <span className="ml-2 text-[#F5C84C]/70">Proj {Math.round(value.projection_final)}</span>
              )}
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors hidden sm:inline">Change</span>
            <X size={13} className="text-white/30 group-hover:text-white/60 transition-colors" />
          </div>
        </button>
      ) : (
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder="Search player..."
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] pl-9 pr-9 py-3.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
            autoComplete="off"
          />
          {query.length > 0 && (
            <button
              onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {showDropdown && (
        <div className="absolute z-50 mt-1.5 w-full rounded-xl border border-white/[0.08] bg-[#111] shadow-2xl overflow-hidden">
          {loading ? (
            <div className="flex items-center gap-2.5 px-4 py-3.5">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-white/10 border-t-white/40 animate-spin shrink-0" />
              <span className="text-xs text-white/30">Searching...</span>
            </div>
          ) : results.length === 0 ? (
            <div className="px-4 py-4 text-center">
              <p className="text-xs text-white/30">No players found</p>
              <p className="text-[11px] text-white/20 mt-1">Try a different name</p>
            </div>
          ) : (
            <div ref={listRef} className="max-h-60 overflow-y-auto overscroll-contain">
              {results.map((p, i) => (
                <button
                  key={p.player_id}
                  onMouseDown={(e) => { e.preventDefault(); select(p); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors border-b border-white/[0.04] last:border-0 ${activeIndex === i ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.player_name}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      {[p.team, p.position].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="shrink-0 ml-3 flex items-center gap-2">
                    {p.projection_final != null && (
                      <span className="text-[10px] text-white/25 tabular-nums hidden sm:inline">
                        {Math.round(p.projection_final)} proj
                      </span>
                    )}
                    {p.neeko_rating != null && (
                      <span className="text-xs font-bold text-[#F5C84C]/70 tabular-nums">
                        {Number(p.neeko_rating).toFixed(1)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
