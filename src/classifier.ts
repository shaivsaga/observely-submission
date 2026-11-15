import modelJson from "../app/src/main/assets/model.json";

/** Same shape as app/src/main/assets/model.json, which the Android app loads. */
type VocabEntry = [idf: number, weight: number];
type Model = { v: Record<string, VocabEntry>; b: number; cut: number };

const model = modelJson as unknown as Model;
const TOKEN = /\b\w\w+\b/g;

/** Kept word-for-word in step with Classifier.kt. */
const SIGNS: ReadonlyArray<readonly [string, RegExp]> = [
  ["pressure to act now", /\b(urgent|immediately|final notice|act now|last chance|expires?|within \d+ ?(hours?|hrs?|days?))\b/i],
  ["a prize or free item", /\b(won|winner|prize|free|congratulations|reward|refund|claim)\b/i],
  ["a link to tap", /(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|net|xyz|top|info|cc|ly|co)\b/i],
  ["a payment or fee first", /\b(fee|gift ?cards?|payment|wire|bitcoin|crypto|transfer)\b/i],
  ["account locked, confirm details", /\b(suspended|locked|verify|confirm|password|log ?in|sign in|otp|pin)\b/i],
  ["a famous name giving things away", /\b(giveaway|giving away|mrbeast|elon)\b/i],
  ["someone to text for the payout", /\b(text|message|contact|call|dm) my (associate|agent|assistant|friend|partner)\b/i],
  ["a one-time code to hand over", /\b(send|share|reply with|give me) (this|the|that)? ?(code|otp|pin|password)\b/i],
];

export type Check = {
  /** Final verdict: the model fires, or at least two warning signs match. */
  bad: boolean;
  /** Model probability, 0 to 1, before the warning-sign override. */
  score: number;
  cutoff: number;
  fromModel: boolean;
  /** False when no word in the message exists in the model's vocabulary (e.g. non-Latin script). */
  readable: boolean;
  words: string[];
  signs: string[];
};

export function check(text: string): Check {
  const counts = new Map<string, number>();
  for (const match of text.toLowerCase().matchAll(TOKEN)) {
    const word = match[0];
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  const tf = new Map<string, number>();
  for (const [word, count] of counts) {
    if (Object.hasOwn(model.v, word)) tf.set(word, count * model.v[word][0]);
  }

  let sumSquares = 0;
  for (const value of tf.values()) sumSquares += value * value;
  const norm = sumSquares > 0 ? Math.sqrt(sumSquares) : 1;

  let z = model.b;
  const contributions: Array<[string, number]> = [];
  for (const [word, value] of tf) {
    const contribution = (value / norm) * model.v[word][1];
    z += contribution;
    contributions.push([word, contribution]);
  }

  const score = 1 / (1 + Math.exp(-(Number.isFinite(z) ? z : model.b)));
  const fromModel = score >= model.cut;
  const signs = SIGNS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  const words = fromModel
    ? contributions
        .filter(([, contribution]) => contribution > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word)
    : [];

  return { bad: fromModel || signs.length >= 2, score, cutoff: model.cut, fromModel, readable: tf.size > 0, words, signs };
}
