import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Save, Calendar } from "lucide-react";
import { AdminSectionIntro } from "@/features/admin/shared/AdminExplain";

interface TeamBye {
  id: number;
  team_name: string;
  season: number;
  bye_round: number;
}

const SEASONS = [2026, 2027];

export default function AdminByeManager() {
  const { toast } = useToast();
  const [season, setSeason] = useState(2026);
  const [byes, setByes] = useState<TeamBye[]>([]);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  async function fetchByes() {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_team_byes", { p_season: season });
    if (error) {
      toast({ title: "Failed to load byes", description: error.message, variant: "destructive" });
    } else {
      setByes((data as TeamBye[]) ?? []);
      setEdits({});
    }
    setLoading(false);
  }

  useEffect(() => { fetchByes(); }, [season]);

  function handleEdit(teamName: string, value: string) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      setEdits(prev => ({ ...prev, [teamName]: num }));
    }
  }

  async function saveBye(teamName: string) {
    const newRound = edits[teamName];
    if (newRound == null) return;
    setSaving(teamName);
    const { error } = await supabase.rpc("admin_update_team_bye", {
      p_team_name: teamName,
      p_season: season,
      p_bye_round: newRound,
    });
    setSaving(null);
    if (error) {
      toast({ title: `Failed to save ${teamName}`, description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bye updated", description: `${teamName} → Round ${newRound} (${season})` });
      setEdits(prev => { const n = { ...prev }; delete n[teamName]; return n; });
      fetchByes();
    }
  }

  const byesByRound = byes.reduce<Record<number, TeamBye[]>>((acc, b) => {
    if (!acc[b.bye_round]) acc[b.bye_round] = [];
    acc[b.bye_round].push(b);
    return acc;
  }, {});

  return (
    <div>
      <AdminSectionIntro
        description="Manage AFL team bye rounds per season. Changes are reflected in player rankings, projections, and AI content automatically on next pipeline run."
      />

      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Season:</span>
        </div>
        <div className="flex gap-1">
          {SEASONS.map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                season === s
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={fetchByes}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Team</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-32">Bye Round</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24">Action</th>
                </tr>
              </thead>
              <tbody>
                {byes.map((b, i) => {
                  const editVal = edits[b.team_name];
                  const isDirty = editVal != null && editVal !== b.bye_round;
                  const isSaving = saving === b.team_name;
                  return (
                    <tr key={b.team_name} className={`border-b border-border/50 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-2.5 font-medium text-foreground">{b.team_name}</td>
                      <td className="px-4 py-2.5 text-center">
                        <input
                          type="number"
                          min={1}
                          max={25}
                          defaultValue={b.bye_round}
                          onChange={e => handleEdit(b.team_name, e.target.value)}
                          className="w-16 rounded border border-border bg-background px-2 py-1 text-sm text-center font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => saveBye(b.team_name)}
                          disabled={!isDirty || isSaving}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition-colors ${
                            isDirty && !isSaving
                              ? "bg-foreground text-background hover:opacity-80"
                              : "text-muted-foreground/40 cursor-not-allowed"
                          }`}
                        >
                          {isSaving
                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                            : <Save className="h-3 w-3" />
                          }
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {Object.keys(byesByRound).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bye Summary — {season}</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(byesByRound)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([round, teams]) => (
                    <div key={round} className="rounded-lg border border-border bg-muted/10 px-4 py-3 min-w-[160px]">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Round {round}</div>
                      <div className="space-y-1">
                        {teams.map(t => (
                          <div key={t.team_name} className="text-xs text-foreground">{t.team_name}</div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
