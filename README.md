# Observely

Observely is a Finance-track hackathon prototype that warns about suspicious SMS text and shows the words or rules behind the warning. The browser scores pasted text locally. The Android prototype scores message previews from supported notifications. This project is a prototype and is not financial advice.

Frozen M1 reached **0.692 recall, with 7 false alarms and 97 misses** on deduplicated D2. Original A0 had a separate, dataset-specific sanity check at **0.867 recall, with 6 false alarms and 42 misses**. See the [submission write-up](SUBMISSION.md) for the baselines, methodology and limitations.

**Live demo:** <https://observely.vercel.app/> · [Public source repository](https://github.com/shaivsaga/observely-submission).

## Run the web app

Install Node.js and npm. Install Bun to run the test suite. This snapshot was checked with Node.js 24 and Bun 1.4.

```sh
npm ci
bun test
npm run typecheck
npm run build
npm run preview -- --host 127.0.0.1
```

Open [localhost:3000](http://localhost:3000/) after the preview starts. Use `npm run dev -- --host 127.0.0.1` in place of the production preview for local development. The production output is in `dist/`.

Browser inference works offline after the page loads. The audit confirmed that an offline reload fails. The production app sends no pasted text to a server, stores only display preferences, and leaves message links inert. The seven built-in examples are synthetic illustrations, labeled as such in the app. They replace original evaluation messages and were excluded from the reported metrics.

## Build Android

See [ANDROID.md](ANDROID.md) for prerequisites, Gradle commands, notification setup and known limits. Device notification delivery remains unverified.

## Model and repository scope

Both apps use one bundled [sanitized A0 derivative](app/src/main/assets/model.json) with 1,491 vocabulary entries, the original 0.51 cutoff, and the same eight warning-sign rules. This repository builds and tests the shipped apps without any dataset, account or API key. The historical training and evaluation inputs, raw SMS, notebook and reviewer artifacts are excluded. The write-up records aggregate results and the source datasets.

Production source comes from commit `326a335fa3745a837783743acd204554732b6cf4`. Public examples and documentation were sanitized for this snapshot. The sanitized asset removes nine phone-number keys and their coefficient pairs from A0's vocabulary. All remaining coefficients and the intercept are unchanged. No retraining was performed. The sanitized asset SHA-256 is `ff0ab3812a1c937cecbad180d94b6134a91b346d3827062156af486ddc8bd5ed`.

On all 655 clean-D2 messages, sanitization changed seven scores (maximum absolute change 0.014885254). It changed zero model-threshold decisions and zero final warnings, so the confusion matrix and precision and recall were identical. Python, TypeScript and Kotlin agreed within 1e-12 on scores and agreed on decisions for both versions on clean D2, the original and synthetic fixtures, and short-message checks. This comparison establishes agreement on the tested inputs.

## Python and browser scores on three original fixtures

The audit harness read UTF-8 JSON using the Windows-1252 default encoding. This turned the Unicode replacement character U+FFFD into three characters, some of which Python treats as word characters. That changed token boundaries, omitted vocabulary hits and shifted the TF-IDF scores. Reading the JSON with `Path.read_text(encoding="utf-8")` restored the original text and matched the browser to within 1e-12. Both default Unicode and explicit ASCII Python token matching gave the same scores on these three correctly decoded texts. The original texts are omitted.

| Original fixture | Python with Windows-1252 misread | Python with UTF-8 and browser | Warning in both cases |
| --- | ---: | ---: | --- |
| Model warning | 0.993984084 | 0.994880607 | Yes |
| Long input | 0.931028453 | 0.939782034 | Yes |
| Emoji prefix | 0.412507832 | 0.468840662 | No |

The affected vocabulary hits were `to` in the first fixture, `250` and `5000` in the second, and `250` in the third. The difference was confined to the probe's decoding. The historical Python evaluator already decoded the corpus as UTF-8, so this finding does not change the reported metrics. Python's Unicode and JavaScript's ASCII word matching can still differ for other text. This check covers only the three original fixtures.

## License

See [LICENSE](LICENSE) for the software and [font licenses](public/fonts/) for the bundled fonts.
