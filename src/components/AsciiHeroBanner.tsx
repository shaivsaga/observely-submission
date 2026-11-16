import { useEffect, useState } from "react";
import type { ScanPhase } from "../hooks/useScanChoreography";

export type PipelineMode =
  | "idle"
  | "scanning"
  | "unreadable"
  | "warn-model"
  | "warn-rules"
  | "quiet";

const MODE_LABELS: Record<PipelineMode, string> = {
  idle: "AWAITING INPUT",
  scanning: "SETTLING INPUT",
  unreadable: "NO VOCABULARY HITS",
  "warn-model": "GATE 01 · MODEL >= 0.51",
  "warn-rules": "GATE 02 · RULES >= 2/8",
  quiet: "BELOW CUTOFF · < 2 RULES",
};

const PHASE_LABELS: Partial<Record<ScanPhase, string>> = {
  init: "01/04 · INIT MATRIX",
  analyze: "02/04 · SCANNING GATES",
  resolve: "03/04 · RESOLVING TEXT",
  evidence: "04/04 · EVIDENCE REVEAL",
};

const SETTLING_GLYPHS = ["░", "▒", "▓", "▚", "▞"] as const;
const GLYPH_CYCLE_MS = 150;
const DEFAULT_SETTLE_MS = 400;

function getReducedMotionPreference(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function AsciiHeroBanner({
  mode,
  scanPhase,
  showVerdict,
  score,
  signCount,
  isSettling,
  settleDurationMs = DEFAULT_SETTLE_MS,
  settleKey,
}: {
  mode: PipelineMode;
  scanPhase: ScanPhase;
  showVerdict?: boolean;
  score: number | null;
  signCount: number;
  isSettling?: boolean;
  settleDurationMs?: number;
  settleKey?: string;
}) {
  const [assembled, setAssembled] = useState(false);
  const [glyph, setGlyph] = useState<string>(SETTLING_GLYPHS[0]);
  const [settlePercent, setSettlePercent] = useState(0);
  const [reducedMotion, setReducedMotion] = useState<boolean>(getReducedMotionPreference);

  const settling = isSettling ?? mode === "scanning";

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setAssembled(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!settling || reducedMotion) {
      setGlyph(SETTLING_GLYPHS[0]);
      return;
    }

    let index = 0;
    setGlyph(SETTLING_GLYPHS[0]);
    const id = window.setInterval(() => {
      index = (index + 1) % SETTLING_GLYPHS.length;
      setGlyph(SETTLING_GLYPHS[index]);
    }, GLYPH_CYCLE_MS);

    return () => window.clearInterval(id);
  }, [settling, reducedMotion]);

  useEffect(() => {
    if (!settling || reducedMotion) {
      setSettlePercent(0);
      return;
    }

    const duration = Math.max(1, settleDurationMs);
    const startTime = performance.now();
    let rafId = 0;
    let lastReported = -1;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      if (pct !== lastReported) {
        lastReported = pct;
        setSettlePercent(pct);
      }
      if (elapsed < duration) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    setSettlePercent(0);
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [settling, settleDurationMs, settleKey, reducedMotion]);

  const isChoreographing =
    !settling &&
    (scanPhase === "init" ||
      scanPhase === "analyze" ||
      scanPhase === "resolve" ||
      scanPhase === "evidence");

  const showGateResults =
    !settling &&
    (!isChoreographing || scanPhase === "resolve" || scanPhase === "evidence");
  const showOutResult =
    !settling &&
    (!isChoreographing || (showVerdict ?? scanPhase === "evidence"));

  const isWarn = showOutResult && (mode === "warn-model" || mode === "warn-rules");
  const isModelActive = showGateResults && mode === "warn-model";
  const isRulesActive = showGateResults && mode === "warn-rules";
  const isQuiet = showOutResult && mode === "quiet";

  const txtActive =
    settling || mode === "scanning" || scanPhase === "init" || scanPhase === "analyze";
  const gatesScanning =
    settling || mode === "scanning" || scanPhase === "analyze";
  const wireInActive =
    settling || mode === "scanning" || scanPhase === "init" || scanPhase === "analyze";
  const wireOutActive =
    !settling && (scanPhase === "resolve" || scanPhase === "evidence");

  const statusText =
    (isChoreographing && PHASE_LABELS[scanPhase]) || MODE_LABELS[mode];

  const stateBadgeText =
    settling && !reducedMotion
      ? `SETTLING [ ${String(settlePercent).padStart(2, " ")}% ]`
      : `[${statusText}]`;

  const hideLiveMetrics = settling || scanPhase === "init" || scanPhase === "analyze";
  const scoreReadout = hideLiveMetrics
    ? ".... / 0.51"
    : score !== null
      ? `${score.toFixed(2)} / 0.51`
      : "--.-- / 0.51";

  const rulesReadout = hideLiveMetrics
    ? "./8 (≥2)"
    : `${signCount}/8 (≥2)`;

  const outLabel = settling
    ? "WAIT"
    : !showOutResult
      ? scanPhase === "resolve"
        ? "SYNC"
        : "SCAN"
      : isWarn
        ? "WARN"
        : isQuiet
          ? "QUIET"
          : mode === "unreadable"
            ? "SKIP"
            : "WAIT";

  const txtLabel = settling
    ? reducedMotion
      ? "SCAN"
      : glyph
    : txtActive
      ? "SCAN"
      : mode === "idle"
        ? "IDLE"
        : "LIVE";

  return (
    <div
      className={`ascii-rig mode-${mode}${isChoreographing ? ` phase-${scanPhase}` : ""}${
        assembled ? " is-assembled" : ""
      }`}
      aria-hidden="true"
    >
      <div className="ascii-rig-bar">
        <span className="ascii-rig-title">┌─ DUAL-GATE PIPELINE</span>
        <span
          className={`ascii-rig-state${
            isWarn
              ? " is-warn"
              : isQuiet
                ? " is-safe"
                : isChoreographing || settling
                  ? " is-scanning"
                  : ""
          }`}
        >
          {stateBadgeText}
        </span>
      </div>

      <div className="ascii-schematic">
        <div
          className={`ascii-node is-input${txtActive ? " is-scanning-node" : ""}`}
          style={{ ["--col" as string]: 0 }}
        >
          <span className="ascii-node-tag">TXT</span>
          <span className="ascii-node-val">{txtLabel}</span>
        </div>

        <span className={`ascii-wire${wireInActive ? " is-scanning" : ""}`}>──┬▶</span>

        <div className="ascii-gates">
          <div
            className={`ascii-gate${
              gatesScanning
                ? " is-scanning-gate"
                : isModelActive
                  ? " is-triggered"
                  : isQuiet
                    ? " is-clear"
                    : ""
            }`}
            style={{ ["--col" as string]: 1 }}
          >
            <span className="ascii-gate-name">TF-IDF 1,500w</span>
            <span className="ascii-gate-meta">{scoreReadout}</span>
          </div>
          <div
            className={`ascii-gate${
              gatesScanning
                ? " is-scanning-gate is-delayed"
                : isRulesActive
                  ? " is-triggered"
                  : showGateResults && signCount > 0
                    ? " is-noted"
                    : ""
            }`}
            style={{ ["--col" as string]: 2 }}
          >
            <span className="ascii-gate-name">RULE GATES</span>
            <span className="ascii-gate-meta">{rulesReadout}</span>
          </div>
        </div>

        <span className={`ascii-wire${wireOutActive ? " is-scanning" : ""}`}>──┴▶</span>

        <div
          className={`ascii-node is-verdict${
            isWarn ? " is-warn" : isQuiet ? " is-safe" : wireOutActive ? " is-scanning-node" : ""
          }`}
          style={{ ["--col" as string]: 3 }}
        >
          <span className="ascii-node-tag">OUT</span>
          <span className="ascii-node-val">{outLabel}</span>
        </div>
      </div>

      <div className="ascii-ruler">
        <span>└─ LOCAL BROWSER EXECUTION · NO NETWORK · NO STORAGE</span>
        <span>─┘</span>
      </div>
    </div>
  );
}
