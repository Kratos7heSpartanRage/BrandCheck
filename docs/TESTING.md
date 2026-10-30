# BrandCheck: insights, revision comparison and visual review

Verified 31 October 2026 (IST). This file records what was tested; it is not a submission or a claim about event eligibility.

Live product: https://brandcheck-codestar-judge.freelynx19.chatgpt.site/workspace  
Public source: https://github.com/Manas-Jain-24/brandcheck/tree/judge-hosted  
Application code commit: `a049c90895e2ab569e72878e99faf1bcfdda36f6`  
Hosted version: 11; deployment succeeded.

## Delivered

1. **Governance insights:** current issue counts by source across saved content, occurrences across sampled review runs, issues cleared in later reviews, reviewer outcomes while findings remained, policy-gap counts and links back to affected drafts. The UI identifies its latest-100-draft and latest-200-event sample and avoids claiming that a cleared issue was necessarily a creator fix.
2. **Revision comparison:** compare a working or saved draft with prior audit snapshots or the last reviewer decision. Added and removed lines, title and image/alt changes appear side by side. Existing per-finding corrections remain selective; changed content must be saved and checked again before submission.
3. **Deeper visual review:** separately consent to send a reduced-size saved preview and approved visual sources to Gemini. Tentative OCR is collapsed and labelled unverified. Source-linked model observations are saved as visual leads outside the finding count. An authorised separate reviewer can confirm or dismiss each lead with a reason after inspecting the original image; only a confirmed lead becomes a finding. Exact asset hash, alt text and colour heuristics remain rule checks. The original image file is not transmitted.

## Verification

- Strict TypeScript and production build passed.
- 46 SQLite-backed service and helper tests passed, including visual consent, saved leads, creator self-confirmation denial, reviewer confirmation, duplicate resolution denial, source validation, approved-name OCR regression, positive-observation filtering, insights and revision diff.
- Local browser: saved a two-revision draft and verified a side-by-side line diff. Opened Insights on a saved workspace with existing review activity.
- Hosted browser: opened the live Insights view. Ran visual analysis on a synthetic screenshot in an isolated QA workspace after deployment. The saved result showed 2 deterministic findings and 1 separate unverified visual lead. Screenshots: [hosted insights](qa/brandcheck-insights-v11.jpg), [local revision comparison](qa/brandcheck-revision-diff-local.jpg), and [hosted visual leads](qa/brandcheck-visual-leads-v11.jpg).

## Limits

- Gemini OCR was observed to invent text in some runs on a small preview. It is retained only as a collapsed, unverified aid; it does not automatically create findings. Visual leads can also be wrong and require a reviewer to inspect the original.
- A full hosted confirmation/dismissal cycle using a second real account was not observed. The separate-identity and permission path passed service tests.
- The history summary is limited to currently returned drafts/events. No automated email or external fact verification is provided.
