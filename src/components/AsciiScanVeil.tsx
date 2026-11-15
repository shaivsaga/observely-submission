import { useEffect, useRef, type RefObject } from "react";
import type { ScanMotion, ScanPhase } from "../hooks/useScanChoreography";

const GLYPHS = ["░", "▒", "▓", "/", "\\", "+", "·", "─"];

function hashCell(col: number, row: number, tick: number): number {
  const n = Math.sin(col * 12.9898 + row * 78.233 + tick * 0.41) * 43758.5453;
  return n - Math.floor(n);
}

interface ThemeColors {
  bg: string;
  cyan: string;
  muted: string;
  alarm: string;
}

function readThemeColors(el: HTMLElement): ThemeColors {
  const styles = getComputedStyle(el);
  return {
    bg: styles.getPropertyValue("--color-paper-2").trim() || "#111614",
    cyan: styles.getPropertyValue("--color-cyan").trim() || "#62dfd7",
    muted: styles.getPropertyValue("--color-muted").trim() || "#8c9691",
    alarm: styles.getPropertyValue("--color-alarm").trim() || "#ff6b5b",
  };
}

/**
 * Lightweight, container-scoped ASCII computational canvas (`aria-hidden`)
 * that renders shifting glyphs (`░ ▒ ▓ / \ + ·`) and a traveling scanline
 * synchronized to the text reveal underneath. Zero React re-renders, zero
 * per-frame style/layout queries.
 */
export function AsciiScanVeil({
  phase,
  motionRef,
  maskTargetRef,
  isWarn,
}: {
  phase: ScanPhase;
  motionRef: RefObject<ScanMotion>;
  maskTargetRef: RefObject<HTMLParagraphElement | null>;
  isWarn: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const propsRef = useRef({ phase, isWarn });
  propsRef.current = { phase, isWarn };

  const isActive = phase === "init" || phase === "analyze" || phase === "resolve";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!isActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const target = maskTargetRef.current;
      if (target) {
        target.style.removeProperty("--reveal-solid");
        target.style.removeProperty("--reveal-edge");
      }
      return;
    }

    let cancelled = false;
    let rafId = 0;

    let colors = readThemeColors(parent);
    const themeObserver = new MutationObserver(() => {
      colors = readThemeColors(parent);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    let layoutW = 0;
    let layoutH = 0;
    let currentDpr = 1;

    const updateCanvasSize = (width: number, height: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.floor(width));
      const h = Math.max(1, Math.floor(height));
      const pixelW = Math.round(w * dpr);
      const pixelH = Math.round(h * dpr);
      layoutW = w;
      layoutH = h;
      currentDpr = dpr;
      if (canvas.width !== pixelW || canvas.height !== pixelH) {
        canvas.width = pixelW;
        canvas.height = pixelH;
      }
    };

    const initialRect = parent.getBoundingClientRect();
    updateCanvasSize(initialRect.width, initialRect.height);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver === "function") {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          updateCanvasSize(entry.contentRect.width, entry.contentRect.height);
        }
      });
      resizeObserver.observe(parent);
    }

    const draw = (now: number) => {
      if (cancelled) return;
      const { phase: pPhase, isWarn: pWarn } = propsRef.current;
      if (pPhase !== "init" && pPhase !== "analyze" && pPhase !== "resolve") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const { progress: pProgress, reveal: pReveal } = motionRef.current ?? {
        progress: 0,
        reveal: 0,
      };

      const target = maskTargetRef.current;
      if (target) {
        const solidPct = Math.max(0, pReveal * 100 - 4).toFixed(1);
        const edgePct = Math.min(100, pReveal * 100 + 3).toFixed(1);
        target.style.setProperty("--reveal-solid", `${solidPct}%`);
        target.style.setProperty("--reveal-edge", `${edgePct}%`);
      }

      const w = layoutW;
      const h = layoutH;
      const dpr = currentDpr;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const { bg, cyan, muted, alarm } = colors;
      const scanY = pReveal * h;
      const veilAlpha = pPhase === "init" ? Math.min(1, pProgress / 0.09) : 1;

      // Subtle background veil ONLY ahead of the scanline so resolved text underneath stays crisp.
      const unrevealedTop = Math.max(0, scanY - 4);
      if (unrevealedTop < h) {
        ctx.globalAlpha = 0.88 * veilAlpha;
        ctx.fillStyle = bg;
        ctx.fillRect(0, unrevealedTop, w, h - unrevealedTop);
      }

      const cellW = 11;
      const cellH = 18;
      const cols = Math.ceil(w / cellW);
      const rows = Math.ceil(h / cellH);
      const tick = Math.floor(now / 65);

      ctx.font = '400 12px "DM Mono", ui-monospace, monospace';
      ctx.textBaseline = "top";
      let lastColor = "";

      for (let r = 0; r < rows; r += 1) {
        const y = r * cellH + 6;
        const distFromBeam = y - scanY;

        // Already resolved cleanly well above the scanline
        if (distFromBeam < -22) continue;

        for (let c = 0; c < cols; c += 1) {
          const x = c * cellW + 8;
          const wave = Math.sin(c * 0.35 + now * 0.008 - r * 0.5);
          const seed = hashCell(c, r, tick);

          // Sparse computational density in init/analyze, dense near beam, dissolving behind beam
          let density = 0.55;
          let alpha = 0.42;
          let color = muted;

          if (Math.abs(distFromBeam) <= 18) {
            // Active scan front: crisp resolving band
            density = 0.92;
            alpha = 0.92 * (1 - Math.abs(distFromBeam) / 22);
            color = pPhase === "resolve" && pWarn ? alarm : cyan;
          } else if (distFromBeam < 0) {
            // Trailing fade right behind the scanline
            const trail = 1 - Math.abs(distFromBeam) / 22;
            density = 0.45 * trail;
            alpha = 0.45 * trail;
            color = cyan;
          } else {
            // Ahead of the scanline: structured shifting ASCII field
            density = pPhase === "init" ? 0.45 + 0.25 * wave : 0.65 + 0.2 * wave;
            alpha = (0.28 + 0.24 * ((wave + 1) * 0.5)) * veilAlpha;
            color = seed > 0.82 ? cyan : muted;
          }

          if (seed > density || alpha < 0.02) continue;

          // Map distance & phase into deterministic glyph progression
          let glyphIdx: number;
          if (Math.abs(distFromBeam) <= 10) {
            glyphIdx = (c + r + tick) % 3; // ░ ▒ ▓ at the beam
          } else if (distFromBeam < 0) {
            glyphIdx = 6; // trailing '·' dissolving into text
          } else {
            glyphIdx = Math.floor(seed * GLYPHS.length) % GLYPHS.length;
          }

          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          if (color !== lastColor) {
            ctx.fillStyle = color;
            lastColor = color;
          }
          ctx.fillText(GLYPHS[glyphIdx], x, y);
        }
      }

      // Crisp 1.5px computational scanline beam
      if (scanY > 1 && scanY < h - 1) {
        const beamColor = pPhase === "resolve" && pWarn ? alarm : cyan;
        const grad = ctx.createLinearGradient(0, scanY - 14, 0, scanY + 14);
        grad.addColorStop(0, "transparent");
        grad.addColorStop(0.5, beamColor);
        grad.addColorStop(1, "transparent");

        ctx.globalAlpha = 0.18;
        ctx.fillStyle = grad;
        ctx.fillRect(0, scanY - 14, w, 28);

        ctx.globalAlpha = 0.85;
        ctx.fillStyle = beamColor;
        ctx.fillRect(0, scanY, w, 1.5);
      }

      ctx.restore();
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      themeObserver.disconnect();
      resizeObserver?.disconnect();
      const target = maskTargetRef.current;
      if (target) {
        target.style.removeProperty("--reveal-solid");
        target.style.removeProperty("--reveal-edge");
      }
    };
  }, [isActive, motionRef, maskTargetRef]);

  return (
    <canvas
      ref={canvasRef}
      className={`specimen-ascii-canvas${isActive ? " is-active" : ""}`}
      aria-hidden="true"
    />
  );
}
