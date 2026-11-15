import type { Check } from "./classifier";

/**
 * Mirrors the exact warning-sign patterns in src/classifier.ts (and Classifier.kt)
 * with global matching enabled so the UI can highlight matched spans in place
 * without altering the shared classifier file.
 */
const SIGN_PATTERNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["pressure to act now", /\b(urgent|immediately|final notice|act now|last chance|expires?|within \d+ ?(hours?|hrs?|days?))\b/gi],
  ["a prize or free item", /\b(won|winner|prize|free|congratulations|reward|refund|claim)\b/gi],
  ["a link to tap", /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|net|xyz|top|info|cc|ly|co)\b/gi],
  ["a payment or fee first", /\b(fee|gift ?cards?|payment|wire|bitcoin|crypto|transfer)\b/gi],
  ["account locked, confirm details", /\b(suspended|locked|verify|confirm|password|log ?in|sign in|otp|pin)\b/gi],
  ["a famous name giving things away", /\b(giveaway|giving away|mrbeast|elon)\b/gi],
  ["someone to text for the payout", /\b(text|message|contact|call|dm) my (associate|agent|assistant|friend|partner)\b/gi],
  ["a one-time code to hand over", /\b(send|share|reply with|give me) (this|the|that)? ?(code|otp|pin|password)\b/gi],
];

const TOKEN_GLOBAL = /\b\w\w+\b/g;

export type SegmentKind = "plain" | "sign" | "word" | "both";

export interface MessageSegment {
  text: string;
  kind: SegmentKind;
  signs: string[];
  word: string | null;
}

interface SpanMatch {
  start: number;
  end: number;
  sign?: string;
  word?: string;
}

/**
 * Splits a message into non-overlapping segments annotated with the exact
 * heuristic warning signs and TF-IDF model words that matched.
 * Guaranteed invariant: segments.map(s => s.text).join("") === text.
 */
export function annotateMessage(text: string, result: Check): MessageSegment[] {
  if (!text) return [];

  const activeSigns = new Set(result.signs);
  const activeWords = new Set(result.words.map((w) => w.toLowerCase()));
  const spans: SpanMatch[] = [];

  for (const [signName, pattern] of SIGN_PATTERNS) {
    if (!activeSigns.has(signName)) continue;
    const regex = new RegExp(pattern.source, pattern.flags);
    for (const match of text.matchAll(regex)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (end > start) {
        spans.push({ start, end, sign: signName });
      }
    }
  }

  if (activeWords.size > 0) {
    for (const match of text.matchAll(TOKEN_GLOBAL)) {
      const raw = match[0];
      const lower = raw.toLowerCase();
      if (!activeWords.has(lower)) continue;
      const start = match.index ?? 0;
      const end = start + raw.length;
      if (end > start) {
        spans.push({ start, end, word: lower });
      }
    }
  }

  if (spans.length === 0) {
    return [{ text, kind: "plain", signs: [], word: null }];
  }

  const boundarySet = new Set<number>([0, text.length]);
  for (const span of spans) {
    boundarySet.add(Math.max(0, Math.min(text.length, span.start)));
    boundarySet.add(Math.max(0, Math.min(text.length, span.end)));
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  const rawSegments: MessageSegment[] = [];

  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (end <= start) continue;

    const sliceText = text.slice(start, end);
    const matchedSigns: string[] = [];
    let matchedWord: string | null = null;

    for (const span of spans) {
      if (span.start <= start && span.end >= end) {
        if (span.sign && !matchedSigns.includes(span.sign)) {
          matchedSigns.push(span.sign);
        }
        if (span.word) {
          matchedWord = span.word;
        }
      }
    }

    const hasSign = matchedSigns.length > 0;
    const hasWord = matchedWord !== null;
    const kind: SegmentKind = hasSign && hasWord ? "both" : hasSign ? "sign" : hasWord ? "word" : "plain";

    const prev = rawSegments[rawSegments.length - 1];
    if (
      prev &&
      prev.kind === kind &&
      prev.word === matchedWord &&
      prev.signs.length === matchedSigns.length &&
      prev.signs.every((s, idx) => s === matchedSigns[idx])
    ) {
      prev.text += sliceText;
    } else {
      rawSegments.push({
        text: sliceText,
        kind,
        signs: matchedSigns,
        word: matchedWord,
      });
    }
  }

  return rawSegments;
}
