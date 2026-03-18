import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Search, X } from "lucide-react";
import type { PlayerOption } from "./types";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Props {
  players: PlayerOption[];
  value: number | null;
  onChange: (id: number | null, name: string | null) => void;
  placeholder?: string;
}

export function PlayerSearchDropdown({ players, value, onChange, placeholder = "Search player…" }: Props) {
  const selected = useMemo(() => players.find(p => p.player_id === value) ?? null, [players, value]);
  const [query, setQuery] = useState(selected?.player_name ?? "");
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 80);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.player_name ?? "");
    }
  }, [open, selected]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return players.slice(0, 30);
    return players.filter(p => p.player_name.toLowerCase().includes(q)).slice(0, 50);
  }, [players, debouncedQuery]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    onChange(null, null);
    setOpen(true);
  }, [onChange]);

  function handleFocus() {
    setOpen(true);
    if (selected) setQuery("");
  }

  const handleSelect = useCallback((p: PlayerOption) => {
    onChange(p.player_id, p.player_name);
    setQuery(p.player_name);
    setOpen(false);
  }, [onChange]);

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null, null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className={`w-full pl-7 pr-7 py-1.5 border rounded-md text-xs bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors ${
            value
              ? "border-emerald-500/50 bg-emerald-950/10"
              : "border-border"
          }`}
        />
        {(query || value) && (
          <button
            onMouseDown={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          {filtered.map(p => (
            <button
              key={p.player_id}
              onMouseDown={() => handleSelect(p)}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex items-center gap-2 transition-colors"
            >
              <span className="font-medium flex-1 truncate">{p.player_name}</span>
              {p.position_group && (
                <span className="text-[10px] text-muted-foreground shrink-0">{p.position_group}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && debouncedQuery.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg px-3 py-2.5 text-xs text-muted-foreground">
          No players found for &ldquo;{debouncedQuery.trim()}&rdquo;
        </div>
      )}
    </div>
  );
}
