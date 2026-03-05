// ─── Video Generator ──────────────────────────────────────────────────────────
// Generates a 1080x1920 vertical social video using Canvas 2D + MediaRecorder.
// 4 slides, ~7 seconds total, exported as WebM (native browser video encoding).
// ─────────────────────────────────────────────────────────────────────────────

export interface VideoSlideData {
  angleTitle: string;
  angleSubtitle: string;
  statLabel: string;
  statValue: string;
  playerName: string;
  team: string;
  position: string | null;
  accentColor: string;
  secondaryStats: Array<{ label: string; value: string }>;
}

const VW = 1080;
const VH = 1920;
const FPS = 30;

// ─── Slide durations (frames) ────────────────────────────────────────────────
const SLIDE_FRAMES = [
  52,  // Slide 1 — title card      (~1.7s)
  56,  // Slide 2 — big stat        (~1.9s)
  72,  // Slide 3 — player + stats  (~2.4s)
  40,  // Slide 4 — branding outro  (~1.3s)
];
const TOTAL_FRAMES = SLIDE_FRAMES.reduce((a, b) => a + b, 0);

// ─── Easing ───────────────────────────────────────────────────────────────────
function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}
function easeInCubic(t: number) {
  return t * t * t;
}

// ─── Text helpers ─────────────────────────────────────────────────────────────
function fillCenteredText(ctx: CanvasRenderingContext2D, text: string, y: number) {
  ctx.fillText(text, VW / 2, y);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
}

// ─── Background ───────────────────────────────────────────────────────────────
function drawBackground(ctx: CanvasRenderingContext2D, accentColor: string) {
  const grad = ctx.createLinearGradient(0, 0, VW, VH);
  grad.addColorStop(0, "#0f172a");
  grad.addColorStop(1, "#020617");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, VH);

  // Subtle grid
  ctx.strokeStyle = "rgba(255,255,255,0.018)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= VW; x += 90) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, VH); ctx.stroke();
  }
  for (let y = 0; y <= VH; y += 90) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VW, y); ctx.stroke();
  }

  // Radial glow top
  const glow1 = ctx.createRadialGradient(VW / 2, -100, 0, VW / 2, -100, 900);
  glow1.addColorStop(0, accentColor + "22");
  glow1.addColorStop(1, "transparent");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, VW, VH);

  // Radial glow bottom
  const glow2 = ctx.createRadialGradient(VW / 2, VH + 200, 0, VW / 2, VH + 200, 900);
  glow2.addColorStop(0, accentColor + "14");
  glow2.addColorStop(1, "transparent");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, VW, VH);
}

// ─── Top accent bar ───────────────────────────────────────────────────────────
function drawAccentBar(ctx: CanvasRenderingContext2D, accentColor: string) {
  const grad = ctx.createLinearGradient(0, 0, VW, 0);
  grad.addColorStop(0, accentColor);
  grad.addColorStop(0.6, accentColor + "88");
  grad.addColorStop(1, "transparent");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VW, 6);
}

// ─── Brand mark ───────────────────────────────────────────────────────────────
function drawBrand(ctx: CanvasRenderingContext2D, accentColor: string, alpha: number) {
  ctx.globalAlpha = alpha;

  // N badge
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.roundRect(72, 72, 64, 64, 14);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.font = "bold 36px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", 72 + 32, 72 + 32);

  // Brand text
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.font = "bold 30px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("NEEKO SPORTS STATS", 152, 72 + 32);

  ctx.globalAlpha = 1;
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function drawFooter(ctx: CanvasRenderingContext2D, accentColor: string, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, VH - 100, VW, 1);
  ctx.fillStyle = accentColor;
  ctx.font = "bold 30px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("neekostats.com.au", 72, VH - 56);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = "24px Inter, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("#AFLFantasy · #FantasyFooty", VW - 72, VH - 56);
  ctx.globalAlpha = 1;
}

// ─── Slide 1: Title Card ──────────────────────────────────────────────────────
function drawSlide1(ctx: CanvasRenderingContext2D, data: VideoSlideData, frame: number) {
  const progress = frame / SLIDE_FRAMES[0];
  const fadeIn = Math.min(progress * 3, 1);
  const slideUp = easeOutCubic(Math.min(progress * 2, 1));

  drawBackground(ctx, data.accentColor);
  drawAccentBar(ctx, data.accentColor);
  drawBrand(ctx, data.accentColor, fadeIn);
  drawFooter(ctx, data.accentColor, fadeIn);

  const centerY = VH / 2;
  const yOffset = (1 - slideUp) * 60;

  ctx.globalAlpha = fadeIn;

  // Accent line
  const lineW = 80 + slideUp * 40;
  ctx.fillStyle = data.accentColor;
  ctx.fillRect(VW / 2 - lineW / 2, centerY - 120 + yOffset, lineW, 5);

  // Angle title
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 92px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  wrapText(ctx, data.angleTitle, VW / 2, centerY - 40 + yOffset, VW - 160, 108);

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "400 38px Inter, Arial, sans-serif";
  fillCenteredText(ctx, data.angleSubtitle, centerY + 120 + yOffset);

  ctx.globalAlpha = 1;
}

// ─── Slide 2: Big Stat ────────────────────────────────────────────────────────
function drawSlide2(ctx: CanvasRenderingContext2D, data: VideoSlideData, frame: number) {
  const progress = frame / SLIDE_FRAMES[1];
  const fadeIn = easeOutCubic(Math.min(progress * 2, 1));
  const scale = 0.6 + easeOutCubic(Math.min(progress * 1.5, 1)) * 0.4;

  drawBackground(ctx, data.accentColor);
  drawAccentBar(ctx, data.accentColor);
  drawBrand(ctx, data.accentColor, fadeIn);
  drawFooter(ctx, data.accentColor, fadeIn);

  const centerY = VH / 2;

  ctx.globalAlpha = fadeIn;

  // Label
  ctx.fillStyle = data.accentColor;
  ctx.font = "700 38px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.letterSpacing = "8px";
  ctx.fillText(data.statLabel.toUpperCase(), VW / 2, centerY - 120);
  ctx.letterSpacing = "0px";

  // Big number with scale
  ctx.save();
  ctx.translate(VW / 2, centerY + 20);
  ctx.scale(scale, scale);
  ctx.fillStyle = data.accentColor;
  ctx.font = "900 200px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(data.statValue, 0, 0);
  ctx.restore();

  // Player name below stat
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "700 48px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(data.playerName, VW / 2, centerY + 200);

  ctx.globalAlpha = 1;
}

// ─── Slide 3: Player Context ──────────────────────────────────────────────────
function drawSlide3(ctx: CanvasRenderingContext2D, data: VideoSlideData, frame: number) {
  const progress = frame / SLIDE_FRAMES[2];
  const fadeIn = easeOutCubic(Math.min(progress * 2, 1));
  const cardsIn = easeOutCubic(Math.max(0, Math.min((progress - 0.25) * 2, 1)));

  drawBackground(ctx, data.accentColor);
  drawAccentBar(ctx, data.accentColor);
  drawBrand(ctx, data.accentColor, fadeIn);
  drawFooter(ctx, data.accentColor, fadeIn);

  ctx.globalAlpha = fadeIn;

  const centerY = 640;

  // Player name — large
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 110px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const nameParts = data.playerName.split(" ");
  if (nameParts.length >= 2) {
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "700 64px Inter, Arial, sans-serif";
    ctx.fillText(nameParts.slice(0, -1).join(" "), VW / 2, centerY - 60);
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 110px Inter, Arial, sans-serif";
    ctx.fillText(nameParts[nameParts.length - 1], VW / 2, centerY + 60);
  } else {
    ctx.fillText(data.playerName, VW / 2, centerY);
  }

  // Team + position pill
  ctx.fillStyle = data.accentColor + "22";
  ctx.strokeStyle = data.accentColor + "55";
  ctx.lineWidth = 2;
  const pillText = data.position ? `${data.team} · ${data.position}` : data.team;
  ctx.font = "600 34px Inter, Arial, sans-serif";
  const pillW = ctx.measureText(pillText).width + 48;
  const pillX = VW / 2 - pillW / 2;
  ctx.beginPath();
  ctx.roundRect(pillX, centerY + 88, pillW, 60, 30);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = data.accentColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(pillText, VW / 2, centerY + 88 + 30);

  // Stat cards
  ctx.globalAlpha = fadeIn * cardsIn;
  const cardTop = centerY + 200;
  const cardH = 140;
  const cardGap = 20;
  const cardCount = Math.min(data.secondaryStats.length, 3);
  const totalCardsW = VW - 144;
  const cardW = (totalCardsW - (cardCount - 1) * cardGap) / cardCount;

  for (let i = 0; i < cardCount; i++) {
    const stat = data.secondaryStats[i];
    const xPos = 72 + i * (cardW + cardGap);
    const slideY = (1 - cardsIn) * 40;

    ctx.fillStyle = `rgba(255,255,255,0.04)`;
    ctx.strokeStyle = `rgba(255,255,255,0.08)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(xPos, cardTop + slideY, cardW, cardH, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = data.accentColor;
    ctx.font = "800 52px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(stat.value, xPos + cardW / 2, cardTop + slideY + 80);

    ctx.fillStyle = "rgba(255,255,255,0.38)";
    ctx.font = "500 26px Inter, Arial, sans-serif";
    ctx.textTransform = "uppercase";
    ctx.fillText(stat.label.toUpperCase(), xPos + cardW / 2, cardTop + slideY + 118);
  }

  ctx.globalAlpha = 1;
}

// ─── Slide 4: Branding Outro ──────────────────────────────────────────────────
function drawSlide4(ctx: CanvasRenderingContext2D, data: VideoSlideData, frame: number) {
  const progress = frame / SLIDE_FRAMES[3];
  const fadeIn = easeOutCubic(Math.min(progress * 3, 1));
  const fadeOut = progress > 0.6 ? easeInCubic((progress - 0.6) / 0.4) : 0;
  const alpha = fadeIn * (1 - fadeOut * 0.15);

  drawBackground(ctx, data.accentColor);
  drawAccentBar(ctx, data.accentColor);

  ctx.globalAlpha = alpha;

  const centerY = VH / 2;

  // Large N badge
  ctx.fillStyle = data.accentColor;
  ctx.beginPath();
  ctx.roundRect(VW / 2 - 80, centerY - 220, 160, 160, 28);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.font = "900 90px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", VW / 2, centerY - 220 + 80);

  // Brand name
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 56px Inter, Arial, sans-serif";
  ctx.textBaseline = "alphabetic";
  fillCenteredText(ctx, "NEEKO SPORTS STATS", centerY + 20);

  // Tagline
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "400 34px Inter, Arial, sans-serif";
  fillCenteredText(ctx, "AFL Fantasy Intelligence", centerY + 80);

  // URL
  ctx.fillStyle = data.accentColor;
  ctx.font = "700 40px Inter, Arial, sans-serif";
  fillCenteredText(ctx, "neekostats.com.au", centerY + 180);

  ctx.globalAlpha = 1;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateVideo(
  data: VideoSlideData,
  onProgress: (pct: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = VW;
    canvas.height = VH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas 2D not available"));
      return;
    }

    const stream = canvas.captureStream(FPS);
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
      ? "video/webm;codecs=vp8"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(new Error(`MediaRecorder error: ${(e as ErrorEvent).message ?? "unknown"}`));

    recorder.start();

    let globalFrame = 0;

    function tick() {
      if (globalFrame > TOTAL_FRAMES) {
        recorder.stop();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      onProgress(Math.round((globalFrame / TOTAL_FRAMES) * 95));

      // Which slide are we on?
      let remaining = globalFrame;
      let slideIdx = 0;
      let slideFrame = 0;
      for (let i = 0; i < SLIDE_FRAMES.length; i++) {
        if (remaining < SLIDE_FRAMES[i]) {
          slideIdx = i;
          slideFrame = remaining;
          break;
        }
        remaining -= SLIDE_FRAMES[i];
      }

      ctx.clearRect(0, 0, VW, VH);

      switch (slideIdx) {
        case 0: drawSlide1(ctx, data, slideFrame); break;
        case 1: drawSlide2(ctx, data, slideFrame); break;
        case 2: drawSlide3(ctx, data, slideFrame); break;
        case 3: drawSlide4(ctx, data, slideFrame); break;
      }

      globalFrame++;
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  });
}
