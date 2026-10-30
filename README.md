# BrandCheck — Pre-Publication Brand Governance Platform

> **CodeStar 30 — Round 3 Finals Submission** (31 October 2026 – 3 November 2026 IST)  
> **Team:** `mayankkumar.prof` (Manas Jain & Mayank Kumar) | **Problem Statement:** Inkloom AI

---

### 🌐 Quick Access Links

- 🚀 **Live Hosted Fullstack Product:** [brandcheck-codestar-judge.freelynx19.chatgpt.site/workspace](https://brandcheck-codestar-judge.freelynx19.chatgpt.site/workspace)
- 📂 **Fullstack Source Code (Judge Branch):** [github.com/Manas-Jain-24/brandcheck/tree/judge-hosted](https://github.com/Manas-Jain-24/brandcheck/tree/judge-hosted)
- 📄 **Official 4-Page Finals PDF:** [docs/BrandCheck_Round_3_Finals.pdf](docs/BrandCheck_Round_3_Finals.pdf)
- 🧪 **Interactive Client Demo (GitHub Pages):** [manas-jain-24.github.io/brandcheck](https://manas-jain-24.github.io/brandcheck/)

---

### 🌟 Round 3 Finals: Implemented Upgrades & System Limits

All promised Round 2 improvements and 5 competitive upgrades are fully built, tested, and live on the **[`judge-hosted` branch](https://github.com/Manas-Jain-24/brandcheck/tree/judge-hosted)**:

1. **Pre-Flight Compliance Status Bar:** Real-time visual compliance badges (Terminology, Claims and Evidence, Visual Asset Fingerprint) with a dynamic 0–100% Brand Score.
2. **1-Click Batch Terminology Fix (`applyAllTerminologyCorrections`):** Instantly resolves all retired terms across title, body, and multi-part document segments while preserving character offset integrity.
3. **Reviewer Quick-Decision Templates:** Single-click decision notes for authorized reviewers (e.g., *"All terminology and promotional claims verified against active guidelines"*).
4. **Official Brand Clearance Certificate Modal:** Formally generates exportable sign-off certificates for approved content revisions, complete with policy version, audit history, browser print formatting, and 1-click Markdown export.
5. **Smart WCAG 2.2 Contrast Optimizer:** Live badges for WCAG AA Normal Text (4.5:1), WCAG AA Large Text (3.0:1), and WCAG AAA Enhanced (7.0:1), plus an automatic color correction algorithm that adjusts failing hex codes to meet WCAG standards.
6. **Expanded System Limits:** Support for 15 MB files (PDF, DOCX, PNG, JPEG, WebP), up to 40 PDF pages, 400 DOCX paragraphs, 80,000 characters extracted, 10,000 character draft bodies, 160 KB network stream buffers, and 180 daily AI quota.

---

## Judge journey

1. Open the app and choose **Try the guided demo**. No account or API key is needed.
2. Select **Run brand review** for the prepared post. The current rules flag the retired name “Flowly,” an unsupported “2x productivity” claim, absolute wording, and missing image alt text.
3. Open a finding’s source ID to jump to its highlighted approved rule and version. Apply the terminology fix or edit the draft yourself. Add useful alt text and replace the performance promise with a supported description.
4. Run the check again, then submit the version for approval.
5. Switch the clearly labelled **Reviewer · demo** persona, inspect the original and submitted text, comment, and approve or request changes. Approving a snapshot with findings marked **Needs attention** requires a reviewer explanation, even if the creator dismissed them. The decision records the finding IDs accepted as exceptions.
6. Open **Activity & insights** for version history, decision notes and category counts. Reload the tab to confirm that this demo session persists.
7. Choose **New draft** to review another piece of content. Switch between drafts in **Your content**; each retains its own text, status, versions, comments and decisions. Reviewer feedback appears directly above the draft editor.

The role selector is a **simulation**. It is not authentication or permission enforcement for a real organisation.

## Run locally

Requirements: Node.js 22+ and pnpm 11+.

```sh
pnpm install
pnpm dev
```

Open the URL printed by Vite. Run checks with:

```sh
pnpm test          # Runs Vitest unit & benchmark tests
pnpm build         # Typecheck (tsc -b) and Vite bundle
pnpm format:check  # Prettier verification
```

## What works

- A versioned, visible brand pack with approved terminology, product messaging, claim policy, tone guidance, accessibility guidance and asset policy. A user can define additional terminology pairs in the demo session.
- Multiple independent drafts with a shared approved brand pack. A pending submission stays intact while a creator works on another draft.
- Title and body review with exact retired-term matching and explicitly labelled heuristic checks for each numeric claim (including percentages and decimal multipliers) and absolute language. Multiple claims in one sentence are checked separately; evidence for “2x savings” cannot clear “12x savings.” Image-only drafts also receive accessibility and asset checks.
- Local import of TXT and Markdown drafts up to 5,000 characters, in addition to typing or pasting text. The content stays in the browser session.
- Image upload for PNG, JPEG and WebP files under 750 KB. The app checks missing alt text and computes a SHA-256 fingerprint to route an unrecognised upload to a reviewer. A demo reviewer can approve that exact fingerprint for future checks in the session. The bundled illustration is an approved sample asset.
- Reviewer-entered claim evidence with a phrase, reference and expiry. A matching, current evidence entry suppresses the corresponding evidence-needed finding. The app does **not** verify that the entered reference is genuine.
- Each finding includes an excerpt, location, category, severity, evidence status, explanation, source ID/version and suggested next step. A creator may apply the simple term replacement or dismiss a finding with a reason.
- Creator submission, separate demo reviewer decision, comments, version comparison and an activity timeline. Editing an approved draft requires a new check and decision.
- Reviews are tied to the content, approved source data and evidence date. Editing shared guidelines or reaching a new evidence date requires a fresh check before another submission.
- Browser-tab session persistence and simple issue counts. Local rules and the offline demo run in the browser; hybrid review with a key sends the draft and brand context to Google Gemini.
- **Grounded Gemini AI Review Engine** (`gemini-3.1-flash-lite` by default): Hybrid review combines deterministic rules with semantic review. A live sample review on 27 October 2026 returned six merged findings with active source IDs in approximately 17 seconds. This smoke test does not establish accuracy across real brand material.
- **Executive AI Governance Assessment Suite**: Displays overall Risk Exposure levels (Low, Moderate, High, Critical), compliance score (0–100), claim & tone analysis, and full compliant draft rewrite with one-click application.
- **Brand Pack Portability**: Export and import versioned Brand Packs in JSON format (`BrandPackExport`), ensuring zero data lock-in and team reproducibility.
- **Quantitative 5-Draft Benchmark Suite**: 24 automated Vitest tests covering 100% source grounding resolution, active vs expired claim evidence, unapproved asset hashes, and high-risk outlandish marketing copy.

## Architecture

```text
React interface
  ├── Versioned NovaDesk brand pack + custom demo terms/evidence
  ├── Review engine: deterministic matches + disclosed heuristics
  ├── Findings with approved source IDs and versions
  ├── Creator/reviewer demo workflow + version history
  └── sessionStorage for synthetic demo state
```

`src/model.ts` contains typed records and the fictional seed pack. `src/review.ts` contains the review checks. `src/workspace.ts` manages draft switching, edits, review freshness and decision validation. `src/App.tsx` contains the interface and browser-session state. The review and workspace tests cover source grounding, claim evidence, asset fingerprints, isolated draft histories, delayed imports and reviewer exceptions. The GitHub Pages workflow in `.github/workflows/deploy.yml` builds and publishes the Vite output from `main`.

This architecture gives judges a usable public link with only a GitHub account. It deliberately does not claim real collaboration or production security. The earlier Round 1 proposal considered Next.js and Supabase; this implementation uses React/Vite, GitHub Pages and local rules because those other services were not available to the team during this build.

## Privacy, security and accessibility

- Sample content is fictional. Do not put confidential brand material in this public demo.
- Draft text, image previews, source edits, comments and decisions are stored in this tab’s `sessionStorage`. Hybrid review with a key sends text, image metadata and brand context to Google Gemini. API keys are kept in memory, sent in an HTTPS header, and cleared on reload. The app has no backend or analytics SDK. Font files are not loaded from an external service.
- Uploads are limited to PNG/JPEG/WebP under 750 KB. SHA-256 is used for file identity only; it does not establish visual correctness or asset ownership.
- Findings distinguish rule matches, review suggestions and evidence-needed claims. The app does not call an unverified claim false. Human decisions remain visible in the demo timeline.
- Fields have labels, keyboard-focus styles and image-alt guidance. Decorative images can be marked as such. Automated accessibility audit and assistive-technology testing remain future work.

## Known limits

- Browser role switching is a labelled simulation. Anyone using the tab can change personas. There are no real user accounts or server-side access checks.
- Session data is local to a tab, is not shared across devices and may be unavailable if the browser blocks storage. It is not a secure system of record.
- Text checks use deterministic rules and heuristics. They may miss nuanced tone, paraphrased claims, visual misuse or inaccurate alt text. A current, reviewer-entered evidence phrase is accepted without verifying the underlying reference.
- Uploaded image checks use file fingerprint and metadata. There is no visual classifier. PDF/DOCX extraction and external integrations are not implemented.
- The product has not been tested with real organisations or real confidential content. The issue counts are demo-session signals, not population-level insights.

## Components and build record

This project uses React, React DOM, Vite, TypeScript, Vitest, Prettier, pnpm and GitHub Pages/Actions. Its code and illustration were created for this project; no Inkloom repository code or earlier product template was copied.

The first product commit is dated **26 October 2026, 1:49 AM IST**. Git history preserves the development record. Individual contribution statements should describe each teammate’s actual work.

## AI & External Services Disclosure

- **Model Used**: Google Gemini (`gemini-3.1-flash-lite` by default, verified with a live sample request). The configured models are listed in `src/model.ts`. Availability can vary by account and service capacity.
- **Prompt Technique**: The prompt supplies brand context and requests exact source IDs and JSON output (`responseMimeType: "application/json"`). The client checks source IDs; complete validation of every response field remains planned.
- **Hallucination Mitigation**: The client validation layer rejects any finding citing a non-existent or retired Source ID before presenting it to the user.
- **Offline Fallback**: Evaluators without a Gemini API key can run the full hybrid demo using the built-in offline simulation without breaking.
- **Privacy**: No tracking SDKs or analytics. Draft content is only sent to Google Gemini if an API key is configured by the user; otherwise, checks run 100% locally in-browser.

---

## Team Contributions

In accordance with Hackathon Rules 14 and 16, work is divided as planned in the Round 1 proposal:

* **Manas Jain**:
  - Overall product flow, problem research, and presentation structure.
  - Creator and Reviewer UI/UX, persona switching, and version diffing interface.
  - Multi-draft independent workflow management (`workspace.ts`).
  - Core deterministic rules prototype and GitHub Actions CI/CD deployment pipeline.

* **Mayank Kumar**:
  - Grounded AI Review Service (`src/aiReview.ts`) integrating Google Gemini with structured citation.
  - Hybrid review pipeline (`src/review.ts`) merging deterministic and semantic findings.
  - Executive AI Governance Assessment card and compliance scoring suite.
  - Data model extensions (`src/model.ts`) for AI detection methods and brand pack portability.
  - Document file reader (`.txt`, `.md`) and Brand Pack JSON import/export handlers.
  - The 5-draft quantitative benchmark suite (`src/benchmarks/drafts.ts`, `src/benchmark.test.ts`).

---

## Proposed Round 3 additions

1. A grounded semantic review mode for nuanced tone and claims, showing retrieved evidence and uncertainty alongside the existing deterministic checks.
2. Real authenticated workspaces, role-based server permissions and shared audit history so separate people can collaborate securely.
3. PDF/DOCX extraction with page or paragraph references, letting teams review real document drafts before publication.
