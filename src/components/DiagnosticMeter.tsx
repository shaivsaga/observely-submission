import { useEffect, useRef, useState } from "react";

export type Misfire = "false_alarm" | "missed_scam";

function useRollingNumber(target: number, durationMs = 340, immediate = false): number {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);

  useEffect(() => {
    if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    const startVal = currentRef.current;
    if (Math.abs(startVal - target) < 0.001) {
      currentRef.current = target;
      setDisplay(target);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = startVal + (target - startVal) * eased;
      currentRef.current = next;
      setDisplay(next);
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        currentRef.current = target;
        setDisplay(target);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [target, durationMs, immediate]);

  return immediate ? target : display;
}

function scoreCoachNote(
  score: number,
  cutoff: number,
  bad: boolean,
  fired: boolean,
  misfire: Misfire | null,
): string {
  if (misfire === "false_alarm") {
    return `Crossed ${cutoff.toFixed(2)} on everyday account terms — this warning is a false alarm.`;
  }
  if (misfire === "missed_scam") {
    return `Scored ${score.toFixed(2)}, far below ${cutoff.toFixed(2)}, and none of its phrasing tripped a rule.`;
  }
  if (fired) {
    return score >= 0.85
      ? `Well past the ${cutoff.toFixed(2)} line — the wording alone triggered this warning.`
      : `Crossed the ${cutoff.toFixed(2)} line — the wording triggered this warning.`;
  }
  if (bad) {
    return `Stayed below the ${cutoff.toFixed(2)} word cutoff, but two warning signs overrode it.`;
  }
  return `Stayed below the ${cutoff.toFixed(2)} line, and fewer than two warning signs matched.`;
}

const TOTAL_RULES = 8;
const SPECTRUM_CELLS = 28;

export function DiagnosticMeter({
  score,
  cutoff,
  bad,
  fired,
  signCount,
  misfire,
  revealed,
}: {
  score: number;
  cutoff: number;
  bad: boolean;
  fired: boolean;
  signCount: number;
  misfire: Misfire | null;
  revealed: boolean;
}) {
  const animatedTarget = revealed ? score : 0;
  const displayScore = useRollingNumber(animatedTarget, 340, !revealed);
  const clamped = revealed ? Math.max(0, Math.min(score, 1)) : 0;
  const filledCells = Math.round(Math.max(0, Math.min(displayScore, 1)) * SPECTRUM_CELLS);
  const cutoffCell = Math.round(cutoff * SPECTRUM_CELLS);
  const legendState = !revealed
    ? "evaluating…"
    : fired
      ? "model fired"
      : bad
        ? "warning signs decided"
        : "below cutoff";
  const coachNote = revealed
    ? scoreCoachNote(score, cutoff, bad, fired, misfire)
    : "Evaluating TF-IDF model score and 8 warning-sign rules…";
  const overrideTriggered = revealed && !fired && bad;
  const shownSignCount = revealed ? signCount : 0;

  return (
    <div className={`meter${bad && revealed ? " is-warn" : ""}`}>
      <div className="meter-gates">
        <div className={`meter-gate-primary${revealed && fired ? " is-active" : ""}`}>
          <div className="meter-head">
            <div>
              <p className="meter-kicker">Gate 01 · TF-IDF model score</p>
              <p className="meter-score">
                {displayScore.toFixed(2)}
                <span>/ 1.00</span>
              </p>
            </div>
            <p className="meter-state">{legendState}</p>
          </div>

          <div className="ascii-spectrum" aria-hidden="true">
            <span className="ascii-spectrum-bracket">[</span>
            <span className="ascii-spectrum-cells">
              {Array.from({ length: SPECTRUM_CELLS }).map((_, idx) => {
                const isCut = idx === cutoffCell;
                const isFilled = idx < filledCells;
                return (
                  <span
                    key={idx}
                    className={`spec-cell${isFilled ? " is-filled" : ""}${isCut ? " is-cut" : ""}`}
                  >
                    {isCut ? "│" : isFilled ? "█" : "·"}
                  </span>
                );
              })}
            </span>
            <span className="ascii-spectrum-bracket">]</span>
          </div>

          <div className="meter-track" aria-hidden="true">
            <div className="meter-fill" style={{ transform: `scaleX(${clamped})` }} />
            <span className="meter-cut" style={{ left: `${cutoff * 100}%` }} />
          </div>

          <div className="meter-scale" aria-hidden="true">
            <span>0.00</span>
            <span className="meter-scale-cut" style={{ left: `${cutoff * 100}%` }}>
              {cutoff.toFixed(2)} cutoff
            </span>
            <span>1.00</span>
          </div>
        </div>

        <div className={`meter-gate-rules${overrideTriggered ? " is-active" : ""}`}>
          <div className="rules-gate-head">
            <span className="meter-kicker">Gate 02 · Rule override</span>
            <span className="rules-gate-ratio">
              {shownSignCount} / {TOTAL_RULES}
            </span>
          </div>
          <div className="rules-cells" aria-hidden="true">
            {Array.from({ length: TOTAL_RULES }).map((_, idx) => {
              const hit = idx < shownSignCount;
              return (
                <span
                  key={idx}
                  style={{ ["--cell-idx" as string]: idx }}
                  className={`rule-cell${hit ? " is-hit" : ""}`}
                >
                  {hit ? "■" : "□"}
                </span>
              );
            })}
          </div>
          <p className="rules-gate-note">
            {!revealed
              ? "Checking 8 warning-sign rules…"
              : signCount >= 2
                ? `${signCount} warning signs matched (≥ 2 triggers warning)`
                : `${signCount} matched (needs ≥ 2 to override)`}
          </p>
        </div>
      </div>

      <p className="meter-coach">
        {coachNote} <span className="meter-disclaimer">Score is a linear model output, not a probability.</span>
      </p>

      <p className="sr-only">
        {revealed
          ? `Model score ${score.toFixed(2)} of 1.00, cutoff ${cutoff.toFixed(2)}, ${
              fired ? "model fired" : bad ? "warning signs decided" : "below cutoff"
            }. ${signCount} of ${TOTAL_RULES} warning signs matched. ${coachNote}`
          : "Evaluating model score and warning signs."}
      </p>
    </div>
  );
}
