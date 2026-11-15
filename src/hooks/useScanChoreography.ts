import { useEffect, useRef, useState, type RefObject } from "react";

export type ScanPhase = "idle" | "init" | "analyze" | "resolve" | "evidence" | "complete";

export interface ScanMotion {
  /** 0..1 continuous timeline progress over the full scan sequence. */
  progress: number;
  /** 0..1 scanline vertical sweep & text reveal fraction. */
  reveal: number;
}

export interface ScanState {
  phase: ScanPhase;
  /** True once matched evidence highlights should illuminate in sequence. */
  showEvidence: boolean;
  /** True once verdict tone, score meter, and headline should settle decisively. */
  showVerdict: boolean;
  /** Increments on each distinct scan trigger to key animations cleanly. */
  runId: number;
  /** Live 0..1 progress & reveal values updated on animation frames without React re-renders. */
  motionRef: RefObject<ScanMotion>;
}

export const TOTAL_DURATION_MS = 960;

// Normalized phase boundaries across TOTAL_DURATION_MS:
// 0.00 - 0.17: Stage A (Initialization)
// 0.17 - 0.39: Stage B (Analysis)
// 0.39 - 0.72: Stage C (Resolution: ASCII -> real message)
// 0.72 - 1.00: Stage D (Evidence reveal + score & verdict settle)
const T_ANALYZE = 0.17;
const T_RESOLVE = 0.39;
const T_EVIDENCE = 0.72;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return 1 - Math.pow(1 - c, 3);
}

function easeInOutQuad(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c < 0.5 ? 2 * c * c : 1 - Math.pow(-2 * c + 2, 2) / 2;
}

export interface ScanFrame {
  phase: ScanPhase;
  progress: number;
  reveal: number;
  showEvidence: boolean;
  showVerdict: boolean;
}

/** Pure frame calculation exported for deterministic unit testing. */
export function computeScanFrame(elapsedMs: number): ScanFrame {
  const p = Math.max(0, Math.min(1, elapsedMs / TOTAL_DURATION_MS));

  let phase: ScanPhase = "init";
  if (p >= 1) {
    phase = "complete";
  } else if (p >= T_EVIDENCE) {
    phase = "evidence";
  } else if (p >= T_RESOLVE) {
    phase = "resolve";
  } else if (p >= T_ANALYZE) {
    phase = "analyze";
  }

  // Scanline advances softly through Stage B (0 -> 0.14) then resolves across text in Stage C (0.14 -> 1.0)
  let reveal = 0;
  if (p >= T_EVIDENCE) {
    reveal = 1;
  } else if (p >= T_RESOLVE) {
    const local = (p - T_RESOLVE) / (T_EVIDENCE - T_RESOLVE);
    reveal = 0.14 + 0.86 * easeInOutQuad(local);
  } else if (p >= T_ANALYZE) {
    const local = (p - T_ANALYZE) / (T_RESOLVE - T_ANALYZE);
    reveal = 0.14 * easeOutCubic(local);
  }

  return {
    phase,
    progress: p,
    reveal,
    showEvidence: p >= T_EVIDENCE,
    showVerdict: p >= T_RESOLVE + 0.08,
  };
}

interface InternalScanState {
  key: string | null;
  phase: ScanPhase;
  showEvidence: boolean;
  showVerdict: boolean;
  runId: number;
}

/**
 * Coordinates the 4-stage ASCII-to-Evidence choreography whenever a new readable
 * message finishes classification. Immediately cancels obsolete RAF loops on
 * rapid edits, sample switches, or clear actions, and prevents stale 1-frame
 * flashes when activeKey or settling state changes synchronously.
 */
export function useScanChoreography(
  activeKey: string | null,
  isSettling: boolean,
): ScanState {
  const runCounterRef = useRef(0);
  const motionRef = useRef<ScanMotion>({
    progress: activeKey && !isSettling ? 1 : 0,
    reveal: activeKey && !isSettling ? 1 : 0,
  });

  const [state, setState] = useState<InternalScanState>(() => {
    if (!activeKey || isSettling) {
      return { key: null, phase: "idle", showEvidence: false, showVerdict: false, runId: 0 };
    }
    if (prefersReducedMotion()) {
      return { key: activeKey, phase: "complete", showEvidence: true, showVerdict: true, runId: 0 };
    }
    return { key: activeKey, phase: "init", showEvidence: false, showVerdict: false, runId: 0 };
  });

  useEffect(() => {
    // Cancel any active scan immediately if cleared, unreadable, too short, or mid-typing.
    if (!activeKey || isSettling) {
      runCounterRef.current += 1;
      motionRef.current.progress = 0;
      motionRef.current.reveal = 0;
      setState({
        key: null,
        phase: "idle",
        showEvidence: false,
        showVerdict: false,
        runId: runCounterRef.current,
      });
      return;
    }

    runCounterRef.current += 1;
    const currentRun = runCounterRef.current;

    if (prefersReducedMotion()) {
      motionRef.current.progress = 1;
      motionRef.current.reveal = 1;
      setState({
        key: activeKey,
        phase: "complete",
        showEvidence: true,
        showVerdict: true,
        runId: currentRun,
      });
      return;
    }

    let cancelled = false;
    let rafId = 0;
    const startTime = performance.now();

    motionRef.current.progress = 0;
    motionRef.current.reveal = 0;

    let lastPhase: ScanPhase = "init";
    let lastShowEvidence = false;
    let lastShowVerdict = false;

    setState({
      key: activeKey,
      phase: "init",
      showEvidence: false,
      showVerdict: false,
      runId: currentRun,
    });

    const step = (now: number) => {
      if (cancelled) return;
      if (prefersReducedMotion()) {
        motionRef.current.progress = 1;
        motionRef.current.reveal = 1;
        setState({
          key: activeKey,
          phase: "complete",
          showEvidence: true,
          showVerdict: true,
          runId: currentRun,
        });
        return;
      }

      const frame = computeScanFrame(now - startTime);
      motionRef.current.progress = frame.progress;
      motionRef.current.reveal = frame.reveal;

      if (
        frame.phase !== lastPhase ||
        frame.showEvidence !== lastShowEvidence ||
        frame.showVerdict !== lastShowVerdict
      ) {
        lastPhase = frame.phase;
        lastShowEvidence = frame.showEvidence;
        lastShowVerdict = frame.showVerdict;
        setState({
          key: activeKey,
          phase: frame.phase,
          showEvidence: frame.showEvidence,
          showVerdict: frame.showVerdict,
          runId: currentRun,
        });
      }

      if (frame.progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    rafId = window.requestAnimationFrame(step);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
    };
  }, [activeKey, isSettling]);

  // Derive synchronous effective state so switching messages or starting to settle
  // never exposes a 1-frame stale verdict/evidence from the previous message.
  if (!activeKey || isSettling) {
    motionRef.current.progress = 0;
    motionRef.current.reveal = 0;
    return {
      phase: "idle",
      showEvidence: false,
      showVerdict: false,
      runId: state.runId,
      motionRef,
    };
  }

  if (state.key !== activeKey) {
    if (prefersReducedMotion()) {
      motionRef.current.progress = 1;
      motionRef.current.reveal = 1;
      return {
        phase: "complete",
        showEvidence: true,
        showVerdict: true,
        runId: state.runId,
        motionRef,
      };
    }
    motionRef.current.progress = 0;
    motionRef.current.reveal = 0;
    return {
      phase: "init",
      showEvidence: false,
      showVerdict: false,
      runId: state.runId + 1,
      motionRef,
    };
  }

  return {
    phase: state.phase,
    showEvidence: state.showEvidence,
    showVerdict: state.showVerdict,
    runId: state.runId,
    motionRef,
  };
}
