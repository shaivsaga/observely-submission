import { useEffect, useMemo, useRef, useState } from "react";
import { Agentation } from "agentation";
import { check, type Check } from "./classifier";
import { annotateMessage, type MessageSegment } from "./annotate";
import { DEMO_FIXTURE_CASES, EDGE_FIXTURE_CASES, findFixtureByText } from "./fixtures/cases";
import { AsciiHeroBanner, type PipelineMode } from "./components/AsciiHeroBanner";
import {
  buildSignalIndices,
  EvidenceSpecimen,
  type ActiveFilter,
} from "./components/EvidenceSpecimen";
import { DiagnosticMeter, type Misfire } from "./components/DiagnosticMeter";
import { SignalBreakdown } from "./components/SignalBreakdown";
import { useScanChoreography } from "./hooks/useScanChoreography";

const DEBOUNCE_MS = 400;

export type { ActiveFilter };

function verdictCopy(result: Check, misfire: Misfire | null) {
  if (misfire === "false_alarm") {
    return {
      tone: "warn" as const,
      kicker: "Warning · synthetic normal message",
      headline: "We got this one wrong.",
      gateTag: "SYNTHETIC EXAMPLE · FALSE ALARM",
    };
  }
  if (misfire === "missed_scam") {
    return {
      tone: "neutral" as const,
      kicker: "No warning · synthetic spam message",
      headline: "We missed this one.",
      gateTag: "SYNTHETIC EXAMPLE · MISSED SPAM",
    };
  }
  if (result.bad) {
    const override = !result.fromModel;
    return {
      tone: "warn" as const,
      kicker: override ? "Warning · the warning signs decided" : "Warning · the model flagged it",
      headline: "Careful — this looks like a scam.",
      gateTag: override ? "GATE 02 · RULES >= 2/8" : "GATE 01 · MODEL >= 0.51",
    };
  }
  return {
    tone: "neutral" as const,
    kicker: "No pattern matched · not a guarantee",
    headline: "Nothing suspicious matched.",
    gateTag: "BELOW 0.51 · < 2 RULES",
  };
}

function advice(copy: { tone: "warn" | "neutral" }, misfire: Misfire | null) {
  if (misfire === "false_alarm") {
    return (
      <>
        <strong>This example represents a normal message.</strong> When a warning does appear, read the reason before
        acting on it.
      </>
    );
  }
  if (misfire === "missed_scam") {
    return (
      <>
        <strong>This is the failure the filter cannot save you from.</strong> The warning signs below are why a
        person still has to read the message.
      </>
    );
  }
  if (copy.tone === "warn") {
    return (
      <>
        <strong>Don’t tap links or reply.</strong> If you’re unsure, contact the company using a number you
        already trust.
      </>
    );
  }
  return (
    <>
      <strong>That is not a guarantee.</strong> A scam that uses none of these patterns can still slip past this
      prototype.
    </>
  );
}

const SAMPLE_HINTS: Record<string, string> = {
  model_fires: "Model >= 0.51",
  override_fires: "Rules >= 2/8",
  false_alarm: "Synthetic false alarm",
  missed_scam: "Synthetic spam",
  long_600: "Long input",
  emoji: "Unicode prefix",
  trailing_url: "URL ending",
};

export default function App() {
  const [input, setInput] = useState("");
  const [settled, setSettled] = useState("");
  const [showEdgeSamples, setShowEdgeSamples] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null);
  const verdictRef = useRef<HTMLElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);

  const [theme, setTheme] = useState<"light" | "dark">(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark",
  );
  const [audioEnabled, setAudioEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("observely-audio") === "on";
    } catch {
      return false;
    }
  });

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("observely-theme", next);
  };

  const toggleAudio = () => {
    setAudioEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("observely-audio", next ? "on" : "off");
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const message = input.trim();
  const count = message.length;
  const hasInput = count > 0;

  useEffect(() => {
    if (!input.trim()) {
      setSettled(input);
      return;
    }
    const id = window.setTimeout(() => setSettled(input), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [input]);

  const isSettling = hasInput && message !== settled.trim();
  const result = useMemo<Check | null>(
    () => (!isSettling && message ? check(message) : null),
    [isSettling, message],
  );
  const hasVerdict = result !== null && (result.readable || result.bad);
  const unreadable = result !== null && !hasVerdict;
  const segments = useMemo<MessageSegment[]>(
    () => (result && hasVerdict ? annotateMessage(message, result) : []),
    [hasVerdict, message, result],
  );
  const signalIndices = useMemo(
    () => (result ? buildSignalIndices(result) : { signIndex: new Map(), wordIndex: new Map() }),
    [result],
  );
  const activeFixture = useMemo(
    () => (!isSettling && message ? findFixtureByText(message) : undefined),
    [isSettling, message],
  );
  const misfire: Misfire | null =
    activeFixture?.kind === "false_alarm" ? "false_alarm" : activeFixture?.kind === "missed_scam" ? "missed_scam" : null;
  const copy = result ? verdictCopy(result, misfire) : null;

  const activeScanKey = result && hasVerdict ? message : null;
  const scan = useScanChoreography(activeScanKey, isSettling);

  const pipelineMode: PipelineMode = isSettling
    ? "scanning"
    : !message
      ? "idle"
      : unreadable
        ? "unreadable"
        : result?.bad
          ? result.fromModel
            ? "warn-model"
            : "warn-rules"
          : "quiet";

  useEffect(() => {
    setActiveFilter(null);
  }, [message]);

  useEffect(() => {
    if (!result || isSettling) return;
    if (window.matchMedia("(max-width: 919px)").matches) {
      verdictRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [result, isSettling]);

  const announcement =
    isSettling || !message
      ? ""
      : unreadable
        ? "No words matched the model vocabulary. No verdict available."
        : scan.showVerdict && copy
          ? `${copy.kicker}. ${copy.headline}`
          : "";

  const pickSample = (text: string) => {
    setInput(text);
    setSettled(text);
    setActiveFilter(null);
    window.requestAnimationFrame(() => headlineRef.current?.focus());
  };

  const toggleFilter = (next: Exclude<ActiveFilter, null>) => {
    setActiveFilter((curr) =>
      curr && curr.type === next.type && curr.value === next.value ? null : next,
    );
  };

  // Dev-only feedback toolbar; ?agentation=0 keeps it out of demo recordings.
  const showAgentation =
    import.meta.env.DEV && new URLSearchParams(window.location.search).get("agentation") !== "0";

  return (
    <>
      <div className="shell">
        <header className="masthead">
          <div className="masthead-brand">
            <p className="masthead-kicker">On-device SMS scam diagnostic · English &amp; romanised text</p>
            <h1>Observely</h1>
            <p className="lede">
              Paste a text message to see whether it reads as a scam, which words triggered it, and where the classifier can fail.
            </p>
          </div>

          <div className="masthead-instrument">
            <div className="masthead-actions">
              <button
                type="button"
                className="audio-toggle"
                aria-pressed={audioEnabled}
                onClick={toggleAudio}
              >
                {audioEnabled ? "Audio ping: On" : "Audio ping: Off"}
              </button>
              <button
                type="button"
                className="theme-toggle"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleTheme}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>
            <AsciiHeroBanner
              mode={pipelineMode}
              scanPhase={scan.phase}
              showVerdict={scan.showVerdict}
              score={result && hasVerdict ? result.score : null}
              signCount={result && hasVerdict ? result.signs.length : 0}
              isSettling={isSettling}
              settleDurationMs={DEBOUNCE_MS}
              settleKey={input}
              audioEnabled={audioEnabled}
            />
          </div>
        </header>

        <main className="workspace">
          <section className="compose" aria-labelledby="message-label">
            <div className="field-head">
              <label id="message-label" htmlFor="message">
                Message input
              </label>
              <div className="field-tools">
                <span className={`char-count${hasInput ? " is-ready" : ""}`} id="char-count">
                  {count} {count === 1 ? "character" : "characters"}
                </span>
                {input !== "" && (
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => {
                      setInput("");
                      setSettled("");
                      setActiveFilter(null);
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className={`textarea-frame${isSettling ? " is-settling" : ""}`}>
              <textarea
                id="message"
                rows={5}
                value={input}
                placeholder="Paste the suspicious SMS or chat message here…"
                spellCheck={false}
                aria-describedby="char-count privacy"
                onChange={(event) => setInput(event.target.value)}
              />
              <div className={`scan-strip${isSettling ? " is-settling" : ""}`} aria-hidden="true">
                <span className="scan-bar" />
                <span className="scan-label">[···] settling input</span>
              </div>
            </div>

            <p className="hint" id="privacy">
              Checked in your browser. Nothing is stored, logged or sent.
            </p>
          </section>

          <section className="samples-block" aria-labelledby="samples-label">
            <div className="samples-head">
              <p className="samples-label" id="samples-label">
                Try a synthetic sample
              </p>
              <button
                type="button"
                className="edge-toggle"
                aria-expanded={showEdgeSamples}
                aria-controls="edge-samples-drawer"
                onClick={() => setShowEdgeSamples((prev) => !prev)}
              >
                {showEdgeSamples ? "Hide edge cases" : "More real cases (3)"}
              </button>
            </div>

            <div className="samples" role="group" aria-labelledby="samples-label">
              {DEMO_FIXTURE_CASES.map((sample, idx) => {
                const selected = activeFixture?.id === sample.id;
                const code = String(idx + 1).padStart(2, "0");
                return (
                  <button
                    key={sample.id}
                    type="button"
                    className="sample-btn"
                    aria-pressed={selected}
                    onClick={() => pickSample(sample.text)}
                  >
                    <span className="sample-btn-top">
                      <span className="sample-idx" aria-hidden="true">
                        [{code}]
                      </span>
                      <span className="sample-name">{sample.buttonLabel}</span>
                    </span>
                    <span className="sample-sub">{SAMPLE_HINTS[sample.kind]}</span>
                  </button>
                );
              })}
            </div>

            <div
              id="edge-samples-drawer"
              className={`edge-drawer${showEdgeSamples ? " is-open" : ""}`}
              aria-hidden={!showEdgeSamples}
            >
              <div className="edge-drawer-inner">
                <div className="samples edge-samples" role="group" aria-label="Synthetic edge-case samples">
                  {EDGE_FIXTURE_CASES.map((sample, idx) => {
                    const selected = activeFixture?.id === sample.id;
                    const code = String(idx + 5).padStart(2, "0");
                    return (
                      <button
                        key={sample.id}
                        type="button"
                        className="sample-btn"
                        tabIndex={showEdgeSamples ? 0 : -1}
                        aria-pressed={selected}
                        onClick={() => pickSample(sample.text)}
                      >
                        <span className="sample-btn-top">
                          <span className="sample-idx" aria-hidden="true">
                            [{code}]
                          </span>
                          <span className="sample-name">{sample.buttonLabel}</span>
                        </span>
                        <span className="sample-sub">{SAMPLE_HINTS[sample.kind]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <aside className="research-note" aria-label="Measured limits and architecture">
            <div className="research-note-head">
              <span className="research-note-title">Measured boundaries</span>
              <span className="research-note-meta">D1 → D2 evaluation</span>
            </div>
            <p>
              Trained on UCI SMS Spam (D1), recall dropped from <strong>0.87 to 0.69</strong> on 655 clean D2
              messages. This bundled demo uses cutoff <strong>0.51</strong> plus an 8-rule override, which is
              separately unvalidated.
            </p>
          </aside>

          <section
            ref={verdictRef}
            className={`verdict${
              isSettling
                ? " is-idle is-settling"
                : result && hasVerdict
                  ? scan.showVerdict
                    ? result.bad
                      ? " is-warn"
                      : " is-neutral"
                    : " is-scanning-verdict"
                  : result
                    ? " is-neutral"
                    : " is-idle"
            }`}
            aria-label="Check result"
          >
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {announcement}
            </p>

            {!isSettling && !message && (
              <div className="idle-reading">
                <div className="verdict-top-bar">
                  <span className="verdict-kicker-tag">DIAGNOSTIC STAGE · STANDBY</span>
                  <span className="verdict-gate-tag">0.51 CUTOFF · ≥2 RULES</span>
                </div>

                <h2 className="idle-title">Nothing checked yet</h2>
                <p className="idle">
                  Paste a message on the left or pick a synthetic sample to inspect highlighted evidence and gate scores.
                </p>

                <div className="idle-blueprint" aria-hidden="true">
                  <div className="idle-blueprint-head">
                    <span>┌─ HOW EVIDENCE IS MARKED</span>
                    <span>[SPECIMEN PREVIEW] ─┐</span>
                  </div>
                  <div className="idle-blueprint-body">
                    <p className="idle-blueprint-line">
                      <span className="bp-sign">URGENT [S1]</span>: your parcel is held. Pay{" "}
                      <span className="bp-word">free [W1]</span> fee at{" "}
                      <span className="bp-both">bit.ly/claim [S2·W2]</span>
                    </p>
                  </div>
                  <div className="idle-blueprint-legend">
                    <span>[S#] solid underline = warning-sign rule</span>
                    <span>[W#] dotted underline = TF-IDF word</span>
                  </div>
                </div>

                <dl className="checks">
                  <div>
                    <dt>Gate 01 · Model</dt>
                    <dd>TF-IDF and logistic regression using a 1,491-entry privacy-sanitized derivative of A0, which was trained on UCI SMS Spam.</dd>
                  </div>
                  <div>
                    <dt>Gate 02 · Rules</dt>
                    <dd>Two or more of 8 warning-sign rules also warn, even when the score stays below 0.51.</dd>
                  </div>
                </dl>

                <div className="meter meter-resting" aria-hidden="true">
                  <div className="meter-head">
                    <div>
                      <p className="meter-kicker">Gate 01 · TF-IDF model score</p>
                      <p className="meter-score">
                        --.--
                        <span>/ 1.00</span>
                      </p>
                    </div>
                    <p className="meter-state">ready to measure</p>
                  </div>
                  <div className="meter-track">
                    <span className="meter-cut" style={{ left: "51%" }} />
                  </div>
                  <div className="meter-scale">
                    <span>0.00</span>
                    <span className="meter-scale-cut" style={{ left: "51%" }}>
                      0.51 cutoff
                    </span>
                    <span>1.00</span>
                  </div>
                </div>
              </div>
            )}

            {isSettling && (
              <div className="settling-reading">
                <div className="verdict-top-bar">
                  <span className="verdict-kicker-tag">DIAGNOSTIC STAGE · SETTLING INPUT</span>
                  <span className="verdict-gate-tag">WAITING FOR PAUSE</span>
                </div>
                <h2 className="idle-title">Waiting for typing to pause…</h2>
                <p className="idle">
                  Hold for a moment to run the TF-IDF model and 8 warning-sign rules on the updated message.
                </p>
              </div>
            )}

            {!isSettling && unreadable && (
              <div className="unreadable-reading">
                <div className="verdict-top-bar">
                  <span className="verdict-kicker-tag">NO VERDICT</span>
                  <span className="verdict-gate-tag">0 VOCABULARY HITS</span>
                </div>
                <p className="status-kicker neutral">
                  <StatusIcon bad={false} />
                  <span>No verdict · no model vocabulary matched</span>
                </p>
                <h2 className="idle-title" ref={headlineRef} tabIndex={-1}>
                  No words matched the model vocabulary.
                </h2>
                <p className="idle">
                  The model uses an English vocabulary. If a message asks you to tap a link, pay a fee or share a
                  code, verify the request through a source you trust.
                </p>
              </div>
            )}

            {!isSettling && result && hasVerdict && copy && (
              <div
                className={`verdict-body${scan.showVerdict ? " is-verdict-live" : " is-verdict-pending"}`}
                key={`${copy.kicker}|${copy.headline}|${misfire ?? ""}`}
              >
                {scan.showVerdict && misfire && (
                  <div className="misfire">
                    <div className="misfire-head">
                      <p className="misfire-label">
                        {misfire === "false_alarm" ? "! CORRECTION · FALSE ALARM" : "! CORRECTION · MISSED SPAM"}
                      </p>
                      <span className="misfire-source">Synthetic example</span>
                    </div>
                    <p>
                      {misfire === "false_alarm"
                        ? "This example represents a normal message. The filter still warns."
                        : "This example represents spam. The filter stays quiet."}
                    </p>
                  </div>
                )}

                <div className="verdict-top-bar">
                  <div className={`status-kicker ${scan.showVerdict ? copy.tone : "neutral"}`}>
                    <StatusIcon bad={scan.showVerdict && copy.tone === "warn"} />
                    <span>{scan.showVerdict ? copy.kicker : "Analyzing message patterns…"}</span>
                  </div>
                  <span className={`verdict-gate-tag${scan.showVerdict && copy.tone === "warn" ? " is-warn" : ""}`}>
                    {scan.showVerdict ? copy.gateTag : "EVALUATING 2 GATES"}
                  </span>
                </div>

                <h2
                  ref={headlineRef}
                  tabIndex={-1}
                  className={`headline ${scan.showVerdict && copy.tone === "warn" ? "bad" : "neutral"}${
                    scan.showVerdict ? " is-revealed" : " is-pending-headline"
                  }`}
                >
                  {scan.showVerdict ? copy.headline : "Scanning message…"}
                </h2>

                <p className={`advice${scan.showVerdict ? " is-revealed" : " is-pending-advice"}`}>
                  {scan.showVerdict
                    ? advice(copy, misfire)
                    : "Checking vocabulary weights and 8 warning-sign rules."}
                </p>

                <EvidenceSpecimen
                  segments={segments}
                  result={result}
                  indices={signalIndices}
                  activeFilter={activeFilter}
                  isSettling={isSettling}
                  scan={scan}
                  onSelectFilter={toggleFilter}
                  onClearFilter={() => setActiveFilter(null)}
                />

                <SignalBreakdown
                  result={result}
                  indices={signalIndices}
                  activeFilter={activeFilter}
                  revealed={scan.showEvidence}
                  runId={scan.runId}
                  onToggleFilter={toggleFilter}
                />

                <DiagnosticMeter
                  score={result.score}
                  cutoff={result.cutoff}
                  bad={result.bad}
                  fired={result.fromModel}
                  signCount={result.signs.length}
                  misfire={misfire}
                  revealed={scan.showVerdict}
                />

                {scan.showVerdict && activeFixture && (
                  <p className="fixture-note">
                    <span className="fixture-note-prefix" aria-hidden="true">[EXAMPLE]</span> {activeFixture.fixtureNote}
                  </p>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      <footer className="footnote">
        <div className="footnote-inner">
          <p>
            Demo of the classifier only. The Android app in this repository reads SMS notifications on the phone;
            this page reads only what you paste.
          </p>
          <p>
            The bundled model — cutoff 0.51 plus a “two warning signs” override — is separately unvalidated. It is
            not the research protocol’s evaluated M1 arm (cutoff 0.630), so no research score applies here.
          </p>
        </div>
      </footer>

      {showAgentation && <Agentation />}
    </>
  );
}

function StatusIcon({ bad }: { bad: boolean }) {
  if (bad) {
    return (
      <svg className="status-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 2.5L18 17H2L10 2.5Z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
        <path d="M10 8V11.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="10" cy="14.2" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className="status-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M10 9.2V14" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <circle cx="10" cy="6.6" r="0.9" fill="currentColor" />
    </svg>
  );
}
