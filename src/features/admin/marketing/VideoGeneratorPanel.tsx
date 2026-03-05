import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Video, Play, Download, RefreshCw, TriangleAlert as AlertTriangle, X, Check, ChevronDown, Zap } from "lucide-react";
import {
  generateVideo,
  DEFAULT_VIDEO_CONFIG,
  type VideoConfig,
  type VideoSlideData,
  type VideoTemplate,
  type AnimationSpeed,
  type VideoBackground,
  type ExportSize,
} from "../pages/VideoGenerator";
import type { ContentPlayer, StatAngle } from "./GraphicTemplates";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  players: ContentPlayer[];
  selectedAngle: StatAngle;
  dataLoading: boolean;
}

// ─── Option definitions ──────────────────────────────────────────────────────

const TEMPLATES: { id: VideoTemplate; label: string; desc: string }[] = [
  { id: "stat_video",        label: "Stat Video",        desc: "Big stat + player spotlight" },
  { id: "projection_battle", label: "Projection Battle", desc: "Big stat + leaderboard" },
  { id: "leaderboard_video", label: "Leaderboard Video", desc: "Ranked list focus" },
  { id: "player_spotlight",  label: "Player Spotlight",  desc: "Player-first narrative" },
  { id: "breakout_alert",    label: "Breakout Alert",    desc: "Upside + spotlight" },
  { id: "captain_picks",     label: "Captain Picks",     desc: "Leaderboard + spotlight" },
  { id: "trade_targets",     label: "Trade Targets",     desc: "Leaderboard + big stat" },
];

const SLIDE_COUNTS  = [3, 4, 5, 6];
const SLIDE_DURATIONS = [
  { value: 2, label: "2 sec" },
  { value: 3, label: "3 sec" },
  { value: 4, label: "4 sec" },
  { value: 5, label: "5 sec" },
];
const ANIM_SPEEDS: { id: AnimationSpeed; label: string }[] = [
  { id: "slow",   label: "Slow"   },
  { id: "medium", label: "Medium" },
  { id: "fast",   label: "Fast"   },
];
const BACKGROUNDS: { id: VideoBackground; label: string }[] = [
  { id: "dark_gradient",  label: "Dark Gradient"   },
  { id: "stadium_lights", label: "Stadium Lights"  },
  { id: "grass_texture",  label: "Grass Texture"   },
  { id: "analytics_grid", label: "Analytics Grid"  },
  { id: "team_colour",    label: "Team Colour"     },
];
const EXPORT_SIZES: { id: ExportSize; label: string; dims: string }[] = [
  { id: "tiktok_reels",   label: "TikTok / Reels", dims: "1080×1920" },
  { id: "instagram_post", label: "Instagram Post",  dims: "1080×1080" },
];

const WEEKLY_TEMPLATES: { label: string; template: VideoTemplate; angleId: string }[] = [
  { label: "Top Projections",  template: "leaderboard_video", angleId: "top_projections"   },
  { label: "Captain Picks",    template: "captain_picks",     angleId: "captain_picks"     },
  { label: "Breakout Players", template: "breakout_alert",    angleId: "breakout_players"  },
  { label: "Trade Targets",    template: "trade_targets",     angleId: "trade_targets"     },
  { label: "Best Matchups",    template: "projection_battle", angleId: "best_matchups"     },
];

const fmt    = (n: number | null, suffix = "") => n != null ? `${Math.round(Number(n))}${suffix}` : "—";
const fmtDec = (n: number | null, dp = 1, suffix = "") => n != null ? `${Number(n).toFixed(dp)}${suffix}` : "—";

// ─── Helper ──────────────────────────────────────────────────────────────────

function buildSlideData(players: ContentPlayer[], angle: StatAngle): VideoSlideData {
  const top = players[0];
  return {
    angleTitle:    angle.title,
    angleSubtitle: angle.subtitle,
    statLabel:     angle.statLabel,
    statValue:     top ? angle.statFn(top) : "—",
    playerName:    top?.player_name ?? "—",
    team:          top?.team ?? "—",
    position:      top?.position ?? null,
    accentColor:   angle.accentColor,
    secondaryStats: [
      { label: "Projection",  value: top ? fmt(top.projection_final, " pts") : "—" },
      { label: "Ceiling",     value: top ? fmt(top.ceiling_estimate, " pts") : "—" },
      { label: "Consistency", value: top ? fmtDec(top.consistency_score, 0, "%") : "—" },
    ],
    leaderboardRows: players.slice(0, 8).map((p, i) => ({
      rank: i + 1,
      name: p.player_name,
      stat: angle.statFn(p),
    })),
  };
}

// ─── Drop-down helper ────────────────────────────────────────────────────────

interface DropdownProps<T extends string> {
  value: T;
  options: { id: T; label: string; dims?: string; desc?: string }[];
  onChange: (v: T) => void;
  accentColor: string;
  label?: string;
}

function Dropdown<T extends string>({ value, options, onChange, accentColor, label }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value);
  return (
    <div className="relative">
      {label && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-background text-xs font-medium transition-colors hover:bg-muted/40"
      >
        <span className="truncate">{selected?.label ?? value}{selected?.dims ? ` (${selected.dims})` : ""}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-2 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-popover shadow-xl z-30 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { onChange(opt.id); setOpen(false); }}
              className="w-full flex items-start justify-between px-3 py-2.5 text-xs hover:bg-muted/40 transition-colors gap-3"
              style={opt.id === value ? { color: accentColor } : {}}
            >
              <div className="text-left min-w-0">
                <div className="font-medium truncate">{opt.label}{opt.dims ? ` (${opt.dims})` : ""}</div>
                {opt.desc && <div className="text-[10px] opacity-50 mt-0.5">{opt.desc}</div>}
              </div>
              {opt.id === value && <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ background: accentColor }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Narration Cost Warning Modal ────────────────────────────────────────────

function NarrationWarningModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Voice Narration Cost Warning</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Voice narration uses <strong>OpenAI Text-to-Speech</strong> and may incur API costs depending on usage.
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-amber-500/08 border border-amber-500/20 p-3.5 space-y-1.5">
          <p className="text-xs font-semibold text-amber-500">Estimated cost</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            ~$0.002–$0.01 per narration, depending on length.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Narration reads the headline, player name, and stat insight — e.g., <em>"Max Gawn leads Neeko projections this round with a score of 118."</em>
          </p>
        </div>

        <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Free features (no cost)</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            <li>• Graphic rendering</li>
            <li>• Video slide generation + animations</li>
            <li>• Background images</li>
            <li>• Video export (WebM)</li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          This feature should only be used when narration is required. Enable it only if you intend to generate audio.
        </p>

        <div className="flex gap-2.5 pt-1">
          <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1.5" />Cancel
          </Button>
          <Button size="sm" className="flex-1 h-9 text-xs bg-amber-500 hover:bg-amber-600 text-black" onClick={onConfirm}>
            <Check className="h-3.5 w-3.5 mr-1.5" />Enable Narration
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoGeneratorPanel({ players, selectedAngle, dataLoading }: Props) {
  const { toast } = useToast();

  const [config, setConfig]             = useState<VideoConfig>({ ...DEFAULT_VIDEO_CONFIG });
  const [generating, setGenerating]     = useState(false);
  const [progress, setProgress]         = useState(0);
  const [videoBlob, setVideoBlob]       = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl]         = useState<string | null>(null);
  const [showNarrationWarning, setShowNarrationWarning] = useState(false);
  const [weeklyRunning, setWeeklyRunning]               = useState(false);
  const [weeklyDone, setWeeklyDone]                     = useState(0);
  const [weeklyTotal, setWeeklyTotal]                   = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  const accentColor = selectedAngle.accentColor;

  const update = <K extends keyof VideoConfig>(key: K, val: VideoConfig[K]) =>
    setConfig((prev) => ({ ...prev, [key]: val }));

  const estimatedDuration = config.numSlides * config.slideDurationSec;

  const handleGenerate = async () => {
    if (players.length === 0) return;
    setGenerating(true);
    setProgress(0);
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null); }
    setVideoBlob(null);

    try {
      const data = buildSlideData(players, selectedAngle);
      const blob = await generateVideo(data, setProgress, config);
      const url  = URL.createObjectURL(blob);
      setVideoBlob(blob);
      setVideoUrl(url);
      setProgress(100);
      toast({ title: "Video ready", description: "Preview and download below." });
    } catch (err) {
      toast({ title: "Video generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!videoBlob || !videoUrl) return;
    const link = document.createElement("a");
    link.download = `neeko-${selectedAngle.id}-${config.template}.webm`;
    link.href = videoUrl;
    link.click();
    toast({ title: "Video downloading", description: "WebM — compatible with TikTok, Reels, and all modern devices." });
  };

  const handleNarrationToggle = () => {
    if (!config.narrationEnabled) {
      setShowNarrationWarning(true);
    } else {
      update("narrationEnabled", false);
    }
  };

  const handleWeeklyGenerate = async () => {
    if (players.length === 0) return;
    setWeeklyRunning(true);
    setWeeklyDone(0);
    setWeeklyTotal(WEEKLY_TEMPLATES.length);

    for (let i = 0; i < WEEKLY_TEMPLATES.length; i++) {
      const wt = WEEKLY_TEMPLATES[i];
      try {
        const data = buildSlideData(players, selectedAngle);
        data.angleTitle = wt.label;
        const cfg: VideoConfig = { ...config, template: wt.template };
        const blob = await generateVideo(data, () => {}, cfg);
        const link = document.createElement("a");
        link.download = `neeko-weekly-${wt.label.toLowerCase().replace(/\s+/g, "-")}.webm`;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
        await new Promise((r) => setTimeout(r, 400));
      } catch {
        // continue with next video
      }
      setWeeklyDone(i + 1);
    }

    setWeeklyRunning(false);
    toast({ title: "Weekly videos generated", description: `${WEEKLY_TEMPLATES.length} videos downloaded.` });
  };

  return (
    <div className="space-y-5 pt-4 border-t border-border">
      {showNarrationWarning && (
        <NarrationWarningModal
          onConfirm={() => { update("narrationEnabled", true); setShowNarrationWarning(false); }}
          onCancel={() => setShowNarrationWarning(false)}
        />
      )}

      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4" style={{ color: accentColor }} />
        <p className="text-sm font-semibold">Video Generator</p>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border font-medium" style={{ borderColor: `${accentColor}30`, color: accentColor }}>
          Free — local render
        </span>
      </div>

      <p className="text-[11px] text-muted-foreground/60 leading-relaxed -mt-3">
        Creates animated social videos from the active stat angle data.
        Rendered locally in your browser — no server costs.
        Export size: {config.exportSize === "tiktok_reels" ? "1080×1920 (TikTok / Reels)" : "1080×1080 (Instagram)"}.
      </p>

      {/* Settings grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Template */}
        <div className="sm:col-span-2">
          <Dropdown
            value={config.template}
            options={TEMPLATES}
            onChange={(v) => update("template", v)}
            accentColor={accentColor}
            label="Video Template"
          />
        </div>

        {/* Export Size */}
        <Dropdown
          value={config.exportSize}
          options={EXPORT_SIZES}
          onChange={(v) => update("exportSize", v)}
          accentColor={accentColor}
          label="Export Size"
        />

        {/* Background */}
        <Dropdown
          value={config.background}
          options={BACKGROUNDS}
          onChange={(v) => update("background", v)}
          accentColor={accentColor}
          label="Background Style"
        />

        {/* Number of Slides */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Number of Slides</p>
          <div className="grid grid-cols-4 gap-1.5">
            {SLIDE_COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => update("numSlides", n)}
                className="py-2 rounded-lg border text-xs font-semibold transition-all"
                style={
                  config.numSlides === n
                    ? { background: `${accentColor}20`, borderColor: `${accentColor}55`, color: accentColor }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Slide Duration */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Slide Duration</p>
          <div className="grid grid-cols-4 gap-1.5">
            {SLIDE_DURATIONS.map((d) => (
              <button
                key={d.value}
                onClick={() => update("slideDurationSec", d.value)}
                className="py-2 rounded-lg border text-xs font-semibold transition-all"
                style={
                  config.slideDurationSec === d.value
                    ? { background: `${accentColor}20`, borderColor: `${accentColor}55`, color: accentColor }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Animation Speed */}
        <div className="sm:col-span-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">Animation Speed</p>
          <div className="grid grid-cols-3 gap-1.5">
            {ANIM_SPEEDS.map((s) => (
              <button
                key={s.id}
                onClick={() => update("animationSpeed", s.id)}
                className="py-2 rounded-lg border text-xs font-semibold transition-all"
                style={
                  config.animationSpeed === s.id
                    ? { background: `${accentColor}20`, borderColor: `${accentColor}55`, color: accentColor }
                    : { borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }
                }
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Estimated duration */}
      <p className="text-[11px] text-muted-foreground/50">
        Estimated video length: ~{estimatedDuration}s ({config.numSlides} slides × {config.slideDurationSec}s)
      </p>

      {/* Slide layout summary */}
      <div className="rounded-xl bg-muted/20 border border-border/50 p-3.5 space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Slide Layout Preview</p>
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: config.numSlides }, (_, i) => {
            const labels = ["Title", "Big Stat", "Player / Leaderboard", "Outro"];
            const label = labels[Math.min(i, labels.length - 1)];
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium"
                style={{ borderColor: `${accentColor}30`, color: accentColor, background: `${accentColor}0a` }}
              >
                <span className="text-muted-foreground/40">{i + 1}.</span>
                {label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Narration Toggle */}
      <div className="rounded-xl border border-border bg-card p-3.5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold flex items-center gap-1.5">
              Enable AI Voice Narration
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium text-amber-500 border-amber-500/30 bg-amber-500/08">
                May incur cost
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">
              Uses OpenAI TTS. Reads headline, player name, and insight.
              {config.narrationEnabled && " Enabled — audio will be generated when you click Generate Video."}
            </p>
          </div>
          <button
            onClick={handleNarrationToggle}
            className="shrink-0 w-10 h-6 rounded-full border-2 transition-all relative"
            style={config.narrationEnabled
              ? { background: "#F59E0B", borderColor: "#F59E0B" }
              : { background: "transparent", borderColor: "hsl(var(--border))" }
            }
          >
            <span
              className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
              style={{ left: config.narrationEnabled ? "calc(100% - 1.1rem)" : "2px" }}
            />
          </button>
        </div>
        {config.narrationEnabled && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-500">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            Narration enabled — estimated ~$0.002–$0.01 per video.
          </div>
        )}
      </div>

      {/* Generate Button */}
      <Button
        className="w-full h-10 text-xs font-semibold"
        onClick={handleGenerate}
        disabled={generating || players.length === 0 || dataLoading}
        style={players.length > 0 && !generating ? { background: accentColor, color: "#000", borderColor: accentColor } : {}}
      >
        {generating
          ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating… {progress}%</>
          : <><Play className="h-3.5 w-3.5 mr-1.5" />Generate Video</>
        }
      </Button>

      {/* Progress bar */}
      {generating && (
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{ width: `${progress}%`, background: accentColor }}
          />
        </div>
      )}

      {/* Video Preview */}
      {videoUrl && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Video Preview</p>
          <div
            className="rounded-xl overflow-hidden border border-border bg-black mx-auto"
            style={
              config.exportSize === "instagram_post"
                ? { aspectRatio: "1/1", maxWidth: 200 }
                : { aspectRatio: "9/16", maxWidth: 160 }
            }
          >
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs"
            onClick={handleDownload}
            style={{ borderColor: `${accentColor}44`, color: accentColor }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download Video (.webm)
          </Button>
          <p className="text-[10px] text-muted-foreground/45 leading-relaxed">
            WebM format. Compatible with TikTok, Instagram Reels, and all modern browsers.
          </p>
        </div>
      )}

      {/* Weekly Video Generator */}
      <div className="rounded-xl bg-muted/10 border border-border/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5" style={{ color: accentColor }} />
          <p className="text-xs font-semibold">Weekly Video Generator</p>
        </div>
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Automatically generates {WEEKLY_TEMPLATES.length} social media videos using the current stat angle data:
          {" "}{WEEKLY_TEMPLATES.map((t) => t.label).join(", ")}.
        </p>

        {weeklyRunning && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Generating videos…</span>
              <span className="font-semibold tabular-nums" style={{ color: accentColor }}>{weeklyDone} / {weeklyTotal}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${weeklyTotal > 0 ? (weeklyDone / weeklyTotal) * 100 : 0}%`, background: accentColor }}
              />
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs font-semibold"
          onClick={handleWeeklyGenerate}
          disabled={weeklyRunning || players.length === 0 || dataLoading || generating}
          style={!weeklyRunning && players.length > 0 ? { borderColor: `${accentColor}44`, color: accentColor } : {}}
        >
          {weeklyRunning
            ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />Generating {weeklyDone} / {weeklyTotal}…</>
            : <><Zap className="h-3.5 w-3.5 mr-1.5" />Generate Weekly Videos ({WEEKLY_TEMPLATES.length} videos)</>
          }
        </Button>

        <div className="flex flex-wrap gap-1.5">
          {WEEKLY_TEMPLATES.map((t) => (
            <span
              key={t.label}
              className="text-[10px] px-2 py-1 rounded-full border font-medium"
              style={{ borderColor: `${accentColor}25`, color: "hsl(var(--muted-foreground))" }}
            >
              {t.label}
            </span>
          ))}
        </div>

        {/* Cost transparency */}
        <div className="rounded-lg bg-muted/20 border border-border/50 p-2.5 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Cost transparency</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px]">
            <span className="text-emerald-500">FREE: Graphic rendering</span>
            <span className="text-emerald-500">FREE: Video export</span>
            <span className="text-emerald-500">FREE: Animations</span>
            <span className="text-emerald-500">FREE: Backgrounds</span>
            <span className="text-amber-500">COST: Voice narration</span>
            <span className="text-muted-foreground/50">~$0.002–0.01 / video</span>
          </div>
        </div>
      </div>
    </div>
  );
}
