import test from "node:test";
import assert from "node:assert/strict";
import { check } from "../src/classifier";
import { annotateMessage } from "../src/annotate";
import { DEMO_FIXTURE_CASES, EDGE_FIXTURE_CASES, parseCasesCsv } from "../src/fixtures/cases";
import { computeScanFrame, TOTAL_DURATION_MS } from "../src/hooks/useScanChoreography";
import { buildSignalIndices } from "../src/components/EvidenceSpecimen";

test("synthetic fixtures match the live classifier", () => {
  for (const row of [...DEMO_FIXTURE_CASES, ...EDGE_FIXTURE_CASES]) {
    assert.ok(!row.text.includes("[PENDING"), `${row.id} still holds a placeholder`);

    const res = check(row.text);
    assert.equal(res.bad ? "scam" : "not_scam", row.predicted, `predicted mismatch for ${row.id}`);
    assert.ok(Math.abs(res.score - row.score) < 0.001, `score mismatch for ${row.id}`);

    const trigger = res.fromModel ? "model" : res.bad ? "override" : "none";
    assert.equal(trigger, row.trigger, `trigger mismatch for ${row.id}`);
  }
});

test("annotateMessage reconstructs every fixture verbatim and marks matched evidence spans", () => {
  for (const row of [...DEMO_FIXTURE_CASES, ...EDGE_FIXTURE_CASES]) {
    const res = check(row.text);
    const segments = annotateMessage(row.text, res);
    assert.equal(
      segments.map((s) => s.text).join(""),
      row.text,
      `lossless reconstruction failed for ${row.id}`,
    );

    if (res.signs.length > 0) {
      assert.ok(
        segments.some((s) => s.kind === "sign" || s.kind === "both"),
        `expected warning-sign span highlight for ${row.id}`,
      );
    }
    if (res.words.length > 0) {
      assert.ok(
        segments.some((s) => s.kind === "word" || s.kind === "both"),
        `expected model-word span highlight for ${row.id}`,
      );
    }
  }
});

test("annotateMessage handles empty text and overlapping sign/word spans losslessly", () => {
  const emptyRes = check("");
  assert.deepEqual(annotateMessage("", emptyRes), []);

  const scamSample = DEMO_FIXTURE_CASES.find((c) => c.kind === "model_fires");
  assert.ok(scamSample);
  const res = check(scamSample.text);
  const segments = annotateMessage(scamSample.text, res);
  const wonSegment = segments.find((s) => s.text === "WON");
  assert.ok(wonSegment, "expected exact uppercase substring WON");
  assert.equal(wonSegment.kind, "both");
  assert.ok(wonSegment.signs.includes("a prize or free item"));
  assert.equal(wonSegment.word, "won");
});

test("non-Latin text is reported as unreadable rather than quietly clean", () => {
  const hindi = check("आपका खाता ब्लॉक कर दिया गया है, तुरंत सत्यापित करें");
  assert.equal(hindi.readable, false, "a message with no vocabulary hit must not read as checked");

  const english = check("Your parcel is waiting at the front desk");
  assert.equal(english.readable, true);
});

test("override fixture row stays below cutoff and triggers on 2+ warning signs", () => {
  const overrideCase = DEMO_FIXTURE_CASES.find((c) => c.kind === "override_fires");
  if (!overrideCase) throw new Error("Missing override_fires fixture");
  const res = check(overrideCase.text);
  assert.equal(res.fromModel, false);
  assert.equal(res.bad, true);
  assert.ok(res.signs.length >= 2);
});

test("false-alarm and missed-scam synthetic fixtures illustrate classifier errors", () => {
  const falseAlarm = DEMO_FIXTURE_CASES.find((c) => c.kind === "false_alarm");
  const missedScam = DEMO_FIXTURE_CASES.find((c) => c.kind === "missed_scam");
  if (!falseAlarm || !missedScam) throw new Error("Missing error fixture rows");
  assert.equal(falseAlarm.label, "not_scam");
  assert.equal(falseAlarm.predicted, "scam");
  assert.equal(missedScam.label, "scam");
  assert.equal(missedScam.predicted, "not_scam");
});

test("edge fixture rows cover 600+ chars, emoji, and trailing URL", () => {
  const longCase = EDGE_FIXTURE_CASES.find((c) => c.kind === "long_600");
  const emojiCase = EDGE_FIXTURE_CASES.find((c) => c.kind === "emoji");
  const urlCase = EDGE_FIXTURE_CASES.find((c) => c.kind === "trailing_url");
  assert.ok(longCase && longCase.text.length >= 600);
  assert.ok(emojiCase && /[\u{1F300}-\u{1FAFF}]/u.test(emojiCase.text));
  assert.ok(urlCase && /https?:\/\/\S+$/.test(urlCase.text));
});

test("parseCasesCsv parses quoted CSV rows with commas and escaped quotes", () => {
  const csv = [
    "text,label,score,predicted,trigger",
    '"Hello, ""friend"" verify now",scam,0.42,scam,override',
    "See you at 6,not_scam,0.03,not_scam,none",
  ].join("\n");

  const parsed = parseCasesCsv(csv);
  assert.equal(parsed.length, 2);
  assert.deepEqual(parsed[0], {
    text: 'Hello, "friend" verify now',
    label: "scam",
    score: 0.42,
    predicted: "scam",
    trigger: "override",
  });
  assert.deepEqual(parsed[1], {
    text: "See you at 6",
    label: "not_scam",
    score: 0.03,
    predicted: "not_scam",
    trigger: "none",
  });
});

test("computeScanFrame progresses monotonically across 4 stages without premature verdict reveal", () => {
  const f0 = computeScanFrame(0);
  assert.equal(f0.phase, "init");
  assert.equal(f0.reveal, 0);
  assert.equal(f0.showVerdict, false);
  assert.equal(f0.showEvidence, false);

  const fAnalyze = computeScanFrame(TOTAL_DURATION_MS * 0.25);
  assert.equal(fAnalyze.phase, "analyze");
  assert.equal(fAnalyze.showVerdict, false);
  assert.equal(fAnalyze.showEvidence, false);
  assert.ok(fAnalyze.reveal > 0 && fAnalyze.reveal <= 0.14);

  const fResolveEarly = computeScanFrame(TOTAL_DURATION_MS * 0.42);
  assert.equal(fResolveEarly.phase, "resolve");
  assert.equal(fResolveEarly.showVerdict, false);
  assert.equal(fResolveEarly.showEvidence, false);

  const fResolveLate = computeScanFrame(TOTAL_DURATION_MS * 0.55);
  assert.equal(fResolveLate.phase, "resolve");
  assert.equal(fResolveLate.showVerdict, true);
  assert.equal(fResolveLate.showEvidence, false);

  const fEvidence = computeScanFrame(TOTAL_DURATION_MS * 0.8);
  assert.equal(fEvidence.phase, "evidence");
  assert.equal(fEvidence.reveal, 1);
  assert.equal(fEvidence.showVerdict, true);
  assert.equal(fEvidence.showEvidence, true);

  const fComplete = computeScanFrame(TOTAL_DURATION_MS + 200);
  assert.equal(fComplete.phase, "complete");
  assert.equal(fComplete.progress, 1);
  assert.equal(fComplete.reveal, 1);
  assert.equal(fComplete.showVerdict, true);
  assert.equal(fComplete.showEvidence, true);

  const fNegative = computeScanFrame(-50);
  assert.equal(fNegative.phase, "init");
  assert.equal(fNegative.progress, 0);
  assert.equal(fNegative.reveal, 0);
});

test("classifier and signal indices stay consistent across model, override, and quiet cases", () => {
  for (const row of [...DEMO_FIXTURE_CASES, ...EDGE_FIXTURE_CASES]) {
    const res = check(row.text);
    assert.equal(res.bad, res.fromModel || res.signs.length >= 2);
    if (!res.fromModel) {
      assert.deepEqual(res.words, [], `words should be empty when model does not fire (${row.id})`);
    }
    const { signIndex, wordIndex } = buildSignalIndices(res);
    assert.equal(signIndex.size, res.signs.length);
    assert.equal(wordIndex.size, res.words.length);
  }
});

test("browser classifier matches independent reference TF-IDF logistic regression math and all 8 rules", async () => {
  const modelRaw = await import("../app/src/main/assets/model.json");
  const m = (modelRaw.default ?? modelRaw) as { v: Record<string, [number, number]>; b: number; cut: number };

  assert.equal(Object.keys(m.v).length, 1491);
  assert.ok(!Object.keys(m.v).some((word) => /^\d{8,}$/.test(word)), "phone-like vocabulary entry");

  const referenceScore = (text: string): number => {
    const tokens = text.toLowerCase().match(/\b\w\w+\b/g) ?? [];
    const counts = new Map<string, number>();
    for (const tok of tokens) {
      if (Object.hasOwn(m.v, tok)) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
    let normSq = 0;
    const tfidf: Array<[string, number]> = [];
    for (const [w, c] of counts) {
      const val = c * m.v[w][0];
      normSq += val * val;
      tfidf.push([w, val]);
    }
    const norm = normSq > 0 ? Math.sqrt(normSq) : 1;
    let z = m.b;
    for (const [w, val] of tfidf) {
      z += (val / norm) * m.v[w][1];
    }
    return 1 / (1 + Math.exp(-z));
  };

  const probeTexts = [
    ...DEMO_FIXTURE_CASES.map((c) => c.text),
    ...EDGE_FIXTURE_CASES.map((c) => c.text),
    "",
    "ok",
    "Win free cash",
    "constructor",
    "Win free cash constructor",
    "qzxqzxqzx",
    "Call FREE free call urgent claim prize win www.example.invalid",
    "Hey, I'm MrBeast! Giving away cash. Text my associate and send this code immediately.",
    "Your account is locked. Verify your password or send me the OTP pin.",
    "आपका खाता ब्लॉक कर दिया गया है, तुरंत सत्यापित करें",
    "See you at 5pm near the coffee shop.",
  ];

  for (const text of probeTexts) {
    const res = check(text);
    const expected = referenceScore(text);
    assert.ok(
      Math.abs(res.score - expected) < 1e-12,
      `score parity failed: got ${res.score}, expected ${expected}`,
    );
    assert.equal(res.cutoff, m.cut);
    assert.equal(res.fromModel, expected >= m.cut);
    assert.equal(res.bad, res.fromModel || res.signs.length >= 2);
  }

  assert.equal(check("Win free cash").bad, true);
  assert.deepEqual(check("Win free cash constructor"), check("Win free cash"));
  for (const text of ["constructor", "qzxqzxqzx"]) {
    const result = check(text);
    assert.equal(result.readable, false);
    assert.equal(result.bad, false);
    assert.equal(result.score, check("").score);
    assert.ok(Number.isFinite(result.score));
  }

  const rule8Check = check("Send this code to verify your account and contact my associate for the giveaway prize at https://example.invalid immediately with a gift card");
  assert.equal(rule8Check.signs.length, 8);
});

test("regression: sanitized A0 derivative matches Python reference on synthetic vocabulary, transactional, and override examples", () => {
  const specimens: ReadonlyArray<{
    text: string;
    expectedPyScore: number;
    expectedBad: boolean;
    expectedFromModel: boolean;
    minSigns: number;
  }> = [
    {
      // Synthetic account-update false alarm
      text: "Your account has been refilled successfully. Your prepaid account balance is shown on the receipt.",
      expectedPyScore: 0.626953525291,
      expectedBad: true,
      expectedFromModel: true,
      minSigns: 0,
    },
    {
      // Synthetic reminder with narrow vocabulary coverage
      text: "Your turn to cook next week.",
      expectedPyScore: 0.796053145736,
      expectedBad: true,
      expectedFromModel: true,
      minSigns: 0,
    },
    {
      // Synthetic conversational false alarm
      text: "You can call the office for a free copy of the event programme.",
      expectedPyScore: 0.591587627608,
      expectedBad: true,
      expectedFromModel: true,
      minSigns: 1,
    },
    {
      // Synthetic payee notice triggers the two-sign override
      text: "You have registered a new payee. Log in at https://example.invalid and enter the code to confirm. Beware of fraud.",
      expectedPyScore: 0.471847752129,
      expectedBad: true,
      expectedFromModel: false,
      minSigns: 2,
    },
  ];

  for (const s of specimens) {
    const res = check(s.text);
    assert.ok(
      Math.abs(res.score - s.expectedPyScore) < 1e-11,
      `Python parity drift on specimen "${s.text}": ts=${res.score}, py=${s.expectedPyScore}`,
    );
    assert.equal(res.bad, s.expectedBad);
    assert.equal(res.fromModel, s.expectedFromModel);
    assert.equal(res.signs.length, s.minSigns);
    assert.equal(res.readable, true);
  }
});
