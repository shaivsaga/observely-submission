import demoCases from "./demo-cases.json";

export type CaseLabel = "scam" | "not_scam";
export type CaseTrigger = "model" | "override" | "none";
export type FixtureKind =
  | "model_fires"
  | "override_fires"
  | "false_alarm"
  | "missed_scam"
  | "long_600"
  | "emoji"
  | "trailing_url";

export interface CaseRow {
  id: string;
  buttonLabel: string;
  kind: FixtureKind;
  text: string;
  label: CaseLabel;
  score: number;
  predicted: CaseLabel;
  trigger: CaseTrigger;
  fixtureNote: string;
}

interface RawCase {
  kind: FixtureKind;
  label: CaseLabel;
  predicted: CaseLabel;
  score: number;
  trigger: CaseTrigger;
  signs: string[];
  text: string;
  note: string;
}

const BUTTON_LABELS: Record<FixtureKind, string> = {
  model_fires: "Scam (model)",
  override_fires: "Scam (rules)",
  false_alarm: "Normal message",
  missed_scam: "Spam we miss",
  long_600: "600+ characters",
  emoji: "Emoji",
  trailing_url: "Ends in a URL",
};

function toCase(raw: RawCase): CaseRow {
  return {
    id: raw.kind,
    buttonLabel: BUTTON_LABELS[raw.kind],
    kind: raw.kind,
    text: raw.text,
    label: raw.label,
    score: raw.score,
    predicted: raw.predicted,
    trigger: raw.trigger,
    fixtureNote: raw.note,
  };
}

/** Fictional examples that illustrate classifier behavior without exposing original evaluation messages. */
export const DEMO_FIXTURE_CASES: readonly CaseRow[] = (demoCases.demo as RawCase[]).map(toCase);

export const EDGE_FIXTURE_CASES: readonly CaseRow[] = (demoCases.edge as RawCase[]).map(toCase);

export function findFixtureByText(text: string): CaseRow | undefined {
  return [...DEMO_FIXTURE_CASES, ...EDGE_FIXTURE_CASES].find((item) => item.text === text);
}

export interface ParsedCsvRow {
  text: string;
  label: CaseLabel;
  score: number;
  predicted: CaseLabel;
  trigger: CaseTrigger;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCasesCsv(csv: string): ParsedCsvRow[] {
  const lines = csv
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const startIndex = header[0] === "text" ? 1 : 0;

  return lines.slice(startIndex).map((line) => {
    const [text = "", rawLabel = "", rawScore = "0", rawPredicted = "", rawTrigger = "none"] = splitCsvLine(line);
    const label: CaseLabel = rawLabel.trim() === "scam" || rawLabel.trim() === "scam_or_spam" ? "scam" : "not_scam";
    const predicted: CaseLabel =
      rawPredicted.trim() === "scam" || rawPredicted.trim() === "scam_or_spam" ? "scam" : "not_scam";
    const triggerClean = rawTrigger.trim();
    const trigger: CaseTrigger =
      triggerClean === "model" || triggerClean === "override" ? triggerClean : "none";
    const score = Number.parseFloat(rawScore);

    return {
      text,
      label,
      score: Number.isFinite(score) ? score : 0,
      predicted,
      trigger,
    };
  });
}
