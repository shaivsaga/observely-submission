
# Observely — Finance track

> This project is a prototype and is not financial advice.

## The finding

Frozen M1 reached **0.692 recall, with 7 false alarms and 97 misses** on 655 deduplicated D2 messages (218 true positives, 333 true negatives). Recall was 0.87 on D1 test. The 17.5-point drop exceeded the 10-point limit set in advance. The M1 cutoff stayed fixed at 0.630.

## What we built

Observely warns and shows which signals contributed. The browser analyzes pasted text locally and can keep scoring after the page loads if connectivity drops. Offline reload failed in verification. Android can analyze text exposed in supported notification previews and has no `INTERNET` permission. Android notification delivery remains unverified on a device.

The project extends suggested project **4.2.1 Scam text filter** with an outside-dataset evaluation, a breakdown of false alarms by message style, and verdict-only human review.

## How we evaluated it

D1 is the UCI SMS Spam Collection. We removed 403 exact repeats from 5,574 messages, then split the remainder 70/15/15 with seed 42. M1 uses class-balanced TF-IDF logistic regression trained on D1. Its cutoff is the lowest one reaching 95% precision on D1 validation. D2 is the Mishra and Soni SMS Phishing Dataset. We removed case-normalized exact matches and near-duplicates with TF-IDF cosine similarity at least 0.9 against D1. Of 5,971 D2 messages, 5,025 (84%) matched exactly and 5,316 (89%) were removed in total. The remaining data had 315 messages labeled spam or smishing and 340 labeled normal. Dataset labels define this evaluation's classes. They do not independently establish fraud.

| Frozen D2 evaluation | Precision | Recall | False alarms | Misses |
| --- | ---: | ---: | ---: | ---: |
| B0, always predicts normal | — | 0.000 | 0 | 315 |
| B1, any link or bait word | 0.887 | 0.571 | 23 | 135 |
| M1, cutoff 0.630 | 0.969 | 0.692 | 7 | 97 |

M1's reported 95% intervals were 0.94–0.99 for precision and 0.64–0.74 for recall. The exploratory score before D2 deduplication was about 0.97 precision and 0.87 recall. A collection check comparing normal D1 and D2 messages gave AUC 0.804, below the preset 0.9 threshold. M1 flagged 0/72 very short normal messages, 1/34 with numbers or currency, and 3/91 with informal slang. The normal-message buckets for links (2 messages) and all caps (9) were too small to report a rate.

**Original A0 sanity check.** A0 used the same weights as M1, a 0.51 cutoff, and an override when at least two of eight rules matched. On clean D2 it reached **0.867 recall, with 6 false alarms and 42 misses** (0.978 precision). Part of clean D2 informed A0 cutoff selection. The comparison with M1 changes both the cutoff and the rules. This snapshot ships a sanitized A0 derivative with nine phone-number vocabulary entries removed. A comparison on all 655 clean-D2 messages found zero changed warning decisions (273 true positives, 334 true negatives, 6 false positives and 42 false negatives for both versions). Seven scores changed.

**Secondary hosted-model results.** On the 300-message D2 sample, M2 zero-shot scored 0.90 precision and 0.97 recall. M2b, with a pattern table and eight retrieved examples, scored 0.99 and 0.92. False alarms fell from 16 to 1. The pattern table was still a draft and clean D2 had already been seen when that arm was prepared. These sample results are separate from the frozen M1 test.

## Failure cases and human review

The original evaluation found a false alarm on a dataset-labeled normal bank notice with login and link cues. It missed a dataset-labeled spam classified ad that lacked the learned signals. These are descriptions of original evidence with identifying details omitted. The in-app account-update and furniture-sale examples are fictional illustrations, and their scores do not enter the evaluation.

One adult reviewed 30 flagged messages and agreed with the dataset on all 29 they were sure about. They agreed with all 24 true-positive labels and 5 of 6 false-alarm labels. Explanation quality was not assessed.

## Limits and next steps

The reported metrics apply to these datasets. The app can miss spam and flag ordinary messages. A warning merits checking the request through a trusted channel. A quiet result offers no guarantee. Future verification should cover notification delivery on a supported phone and test explanations with more reviewers.

## Sources and code

[Public source repository](https://github.com/shaivsaga/observely-submission).


- [UCI SMS Spam Collection, Almeida and Hidalgo](https://archive.ics.uci.edu/dataset/228/sms%2Bspam%2Bcollection).
- [SMS Phishing Dataset, Mishra and Soni, version 1](https://data.mendeley.com/datasets/f45bkkt8pr/1).
- Historical hosted-model comparison used NVIDIA NIM's Nemotron 3.5 Lightning 30B A3B. The shipped apps run locally using React, Vite and Jetpack Compose. scikit-learn, pandas and NumPy supported the historical evaluation.
- AI assistance included Claude Sonnet 5.5, DeepSeek V4.1 Flash, GPT-6 Luna, GPT-6 Sol and Gemini 4 Hydrogen. Google AI Studio and NVIDIA NIM supported model access. Playwright and FFmpeg supported demo production.
- See the [README](README.md) for the reproducible web build and the [Android guide](ANDROID.md) for the native build.
