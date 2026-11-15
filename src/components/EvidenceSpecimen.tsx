import { useRef } from "react";
import type { Check } from "../classifier";
import type { MessageSegment } from "../annotate";
import type { ScanState } from "../hooks/useScanChoreography";
import { AsciiScanVeil } from "./AsciiScanVeil";

export type ActiveFilter =
  | { type: "sign"; value: string }
  | { type: "word"; value: string }
  | null;

export interface SignalIndexMaps {
  signIndex: Map<string, string>;
  wordIndex: Map<string, string>;
}

export function buildSignalIndices(result: Check): SignalIndexMaps {
  const signIndex = new Map<string, string>();
  result.signs.forEach((sign, i) => {
    signIndex.set(sign, `S${i + 1}`);
  });
  const wordIndex = new Map<string, string>();
  result.words.forEach((word, i) => {
    wordIndex.set(word.toLowerCase(), `W${i + 1}`);
  });
  return { signIndex, wordIndex };
}

function segmentMatchesFilter(segment: MessageSegment, filter: ActiveFilter): boolean {
  if (!filter) return true;
  if (filter.type === "sign") return segment.signs.includes(filter.value);
  return segment.word === filter.value.toLowerCase();
}

export function EvidenceSpecimen({
  segments,
  result,
  indices,
  activeFilter,
  isSettling,
  scan,
  onSelectFilter,
  onClearFilter,
}: {
  segments: MessageSegment[];
  result: Check;
  indices: SignalIndexMaps;
  activeFilter: ActiveFilter;
  isSettling: boolean;
  scan: ScanState;
  onSelectFilter: (next: Exclude<ActiveFilter, null>) => void;
  onClearFilter: () => void;
}) {
  const bodyRef = useRef<HTMLParagraphElement | null>(null);
  const hasAnyHighlights = segments.some((s) => s.kind !== "plain");
  const signCount = result.signs.length;
  const wordCount = result.words.length;

  const summaryParts: string[] = [];
  if (signCount > 0) {
    summaryParts.push(`${signCount} rule ${signCount === 1 ? "sign" : "signs"}`);
  }
  if (wordCount > 0) {
    summaryParts.push(`${wordCount} model ${wordCount === 1 ? "word" : "words"}`);
  }
  const summaryText = summaryParts.length > 0 ? summaryParts.join(" · ") : "0 patterns matched";

  const isScanning =
    !isSettling &&
    (scan.phase === "init" || scan.phase === "analyze" || scan.phase === "resolve");

  const frameStat = isSettling
    ? "[settling input…]"
    : scan.phase === "init"
      ? "[01/04 · initializing scan]"
      : scan.phase === "analyze"
        ? "[02/04 · scanning gates]"
        : scan.phase === "resolve"
          ? "[03/04 · resolving text]"
          : scan.phase === "evidence"
            ? `[04/04 · ${summaryText}]`
            : `[${summaryText}]`;

  let markSeq = 0;

  return (
    <div
      className={`specimen${result.bad && scan.showVerdict ? " is-warn" : ""}${
        isSettling ? " is-settling" : ""
      }${isScanning ? " is-decoding" : ""}${scan.showEvidence ? " is-evidence-live" : ""}`}
      aria-label="Evidence in your message"
    >
      <div className="specimen-frame-top" aria-hidden="true">
        <span className="specimen-corner">┌─</span>
        <span className="specimen-frame-label">EVIDENCE IN YOUR MESSAGE</span>
        <span className="specimen-frame-rule" />
        <span className="specimen-frame-stat">{frameStat}</span>
        <span className="specimen-corner">─┐</span>
      </div>

      <div className="specimen-head-mobile">
        <span className="specimen-title">Evidence in your message</span>
        <span className="specimen-count">
          {isSettling ? "settling input…" : isScanning ? "decoding…" : summaryText}
        </span>
      </div>

      <div className="specimen-body-wrap">
        <p
          ref={bodyRef}
          className={`specimen-body${isScanning ? " is-masked" : ""}`}
        >
          {segments.map((segment, index) => {
            if (segment.kind === "plain") {
              return <span key={index}>{segment.text}</span>;
            }

            const seqIndex = Math.min(markSeq, 8);
            markSeq += 1;

            const matchesFilter = segmentMatchesFilter(segment, activeFilter);
            const isDirectlyActive = activeFilter !== null && matchesFilter;
            const filterTarget: Exclude<ActiveFilter, null> =
              segment.signs.length > 0
                ? { type: "sign", value: segment.signs[0] }
                : { type: "word", value: segment.word ?? segment.text.toLowerCase() };

            const tooltipParts: string[] = [];
            if (segment.signs.length > 0) {
              tooltipParts.push(`Warning sign: ${segment.signs.join(", ")}`);
            }
            if (segment.word) {
              tooltipParts.push(`Model word: "${segment.word}"`);
            }

            const codeTokens: string[] = [];
            for (const s of segment.signs) {
              const code = indices.signIndex.get(s);
              if (code) codeTokens.push(code);
            }
            if (segment.word) {
              const code = indices.wordIndex.get(segment.word.toLowerCase());
              if (code) codeTokens.push(code);
            }

            return (
              <button
                key={`${scan.runId}-${index}-${segment.text}`}
                type="button"
                disabled={!scan.showEvidence}
                style={{ ["--mark-idx" as string]: seqIndex }}
                className={`specimen-mark is-${segment.kind}${
                  scan.showEvidence ? " is-illuminated" : " is-pending-mark"
                }${activeFilter ? (matchesFilter ? " is-focused" : " is-dimmed") : ""}`}
                aria-pressed={scan.showEvidence ? isDirectlyActive : undefined}
                title={scan.showEvidence ? tooltipParts.join(" · ") : undefined}
                onClick={() => (isDirectlyActive ? onClearFilter() : onSelectFilter(filterTarget))}
              >
                <span className="specimen-mark-text">{segment.text}</span>
                {scan.showEvidence && codeTokens.length > 0 && (
                  <sup className="specimen-mark-code" aria-hidden="true">
                    {codeTokens.join("·")}
                  </sup>
                )}
                {scan.showEvidence && tooltipParts.length > 0 && (
                  <span className="sr-only"> ({tooltipParts.join(", ")})</span>
                )}
              </button>
            );
          })}
        </p>

        {isScanning && (
          <AsciiScanVeil
            phase={scan.phase}
            motionRef={scan.motionRef}
            maskTargetRef={bodyRef}
            isWarn={result.bad && scan.showVerdict}
          />
        )}
      </div>

      {!scan.showEvidence ? (
        <p className="specimen-empty-note">
          Scanning text spans against 1,500 vocabulary weights and 8 warning-sign rules…
        </p>
      ) : hasAnyHighlights ? (
        <div className="specimen-legend is-visible">
          {signCount > 0 && (
            <span className="legend-item">
              <span className="legend-swatch is-sign" aria-hidden="true" />
              <span>Solid underline [S#]: warning-sign rule</span>
            </span>
          )}
          {wordCount > 0 && (
            <span className="legend-item">
              <span className="legend-swatch is-word" aria-hidden="true" />
              <span>Dotted underline [W#]: TF-IDF word</span>
            </span>
          )}
          {activeFilter && (
            <button type="button" className="specimen-reset" onClick={onClearFilter}>
              Isolating “{activeFilter.value}” · Show all
            </button>
          )}
        </div>
      ) : (
        <p className="specimen-empty-note">
          Neither the 1,500-word vocabulary cutoff nor the 8 warning-sign rules matched a phrase in this text.
        </p>
      )}

      <div className="specimen-frame-bottom" aria-hidden="true">
        <span className="specimen-corner">└─</span>
        <span className="specimen-frame-rule" />
        <span className="specimen-frame-hint">
          {isScanning
            ? "decoding verbatim text"
            : hasAnyHighlights
              ? "click a highlight to isolate"
              : "no matched spans"}
        </span>
        <span className="specimen-corner">─┘</span>
      </div>
    </div>
  );
}
