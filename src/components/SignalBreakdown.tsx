import type { Check } from "../classifier";
import type { ActiveFilter, SignalIndexMaps } from "./EvidenceSpecimen";

export function SignalBreakdown({
  result,
  indices,
  activeFilter,
  revealed,
  runId,
  onToggleFilter,
}: {
  result: Check;
  indices: SignalIndexMaps;
  activeFilter: ActiveFilter;
  revealed: boolean;
  runId: number;
  onToggleFilter: (next: Exclude<ActiveFilter, null>) => void;
}) {
  if (!revealed) {
    return (
      <dl className="signals is-pending">
        <div>
          <dt>Warning signs</dt>
          <dd>
            <span className="signal-none">scanning 8 rules &amp; 1,500-word vocabulary…</span>
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <dl className="signals is-revealed">
      {result.bad && (
        <div>
          <dt>Why it warned</dt>
          <dd>
            {result.fromModel
              ? result.signs.length > 0
                ? `The model scored above its cutoff, and ${result.signs.length} warning ${
                    result.signs.length === 1 ? "sign" : "signs"
                  } matched.`
                : "The model scored above its cutoff."
              : `The warning signs decided: ${result.signs.length} matched. The model stayed below its cutoff.`}
          </dd>
        </div>
      )}

      <div>
        <dt>Warning signs</dt>
        <dd>
          {result.signs.length > 0 ? (
            <span className="signal-tokens">
              {result.signs.map((sign, idx) => {
                const isSelected = activeFilter?.type === "sign" && activeFilter.value === sign;
                const code = indices.signIndex.get(sign) ?? "S";
                return (
                  <button
                    key={`${runId}-${sign}`}
                    type="button"
                    style={{ ["--token-idx" as string]: idx }}
                    className={`signal-token is-sign${isSelected ? " is-active" : ""}`}
                    aria-pressed={isSelected}
                    onClick={() => onToggleFilter({ type: "sign", value: sign })}
                  >
                    <span className="signal-code" aria-hidden="true">
                      [{code}]
                    </span>
                    <span className="signal-token-text">{sign}</span>
                  </button>
                );
              })}
            </span>
          ) : (
            <span className="signal-none">none matched</span>
          )}
        </dd>
      </div>

      {result.fromModel && (
        <div>
          <dt>Model words</dt>
          <dd>
            {result.words.length > 0 ? (
              <span className="signal-tokens">
                {result.words.map((word, idx) => {
                  const isSelected = activeFilter?.type === "word" && activeFilter.value === word;
                  const code = indices.wordIndex.get(word.toLowerCase()) ?? "W";
                  return (
                    <button
                      key={`${runId}-${word}`}
                      type="button"
                      style={{ ["--token-idx" as string]: result.signs.length + idx }}
                      className={`signal-token is-word${isSelected ? " is-active" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => onToggleFilter({ type: "word", value: word })}
                    >
                      <span className="signal-code" aria-hidden="true">
                        [{code}]
                      </span>
                      <span className="signal-token-text">{word}</span>
                    </button>
                  );
                })}
              </span>
            ) : (
              <span className="signal-none">none</span>
            )}
          </dd>
        </div>
      )}
    </dl>
  );
}
