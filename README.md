# BrandCheck

A functional, self-serve brand-governance demo for CodeStar 30, by team **mayankkumar.prof** (Manas Jain and Mayank kumar). The sample organisation, NovaDesk, is fictional.

## Judge journey

1. Open the app and choose **Try the guided demo**. No account or API key is needed.
2. Select **Run brand review** for the prepared post. The current rules flag the retired name “Flowly,” an unsupported “2x productivity” claim, absolute wording, and missing image alt text.
3. Open a finding’s source ID to inspect the approved rule and its version. Apply the terminology fix or edit the draft yourself. Add useful alt text and replace the performance promise with a supported description.
4. Run the check again, then submit the version for approval.
5. Switch the clearly labelled **Reviewer · demo** persona, inspect the original and submitted text, comment, and approve or request changes.
6. Open **Activity & insights** for version history, decision notes and category counts. Reload the tab to confirm that this demo session persists.

The role selector is a **simulation**. It is not authentication or permission enforcement for a real organisation.

## Run locally

Requirements: Node.js 22+ and pnpm 11+.

```sh
pnpm install
pnpm dev
```

Open the URL printed by Vite. Run checks with:

```sh
pnpm test
pnpm build
pnpm format:check
```

## What works

- A versioned, visible brand pack with approved terminology, product messaging, claim policy, tone guidance, accessibility guidance and asset policy. A user can define additional terminology pairs in the demo session.
- Text review with exact retired-term matching and explicitly labelled heuristic checks for numeric claims and absolute language.
- Image upload for PNG, JPEG and WebP files under 750 KB. The app checks missing alt text and computes a SHA-256 fingerprint to route an unrecognised upload to a reviewer. The bundled illustration is an approved sample asset.
- Reviewer-entered claim evidence with a phrase, reference and expiry. A matching, current evidence entry suppresses the corresponding evidence-needed finding. The app does **not** verify that the entered reference is genuine.
- Each finding includes an excerpt, location, category, severity, evidence status, explanation, source ID/version and suggested next step. A creator may apply the simple term replacement or dismiss a finding with a reason.
- Creator submission, separate demo reviewer decision, comments, version comparison and an activity timeline. Editing an approved draft requires a new check and decision.
- Browser-tab session persistence and simple issue counts. The checks run locally in the browser without sending draft text to a server.

## Architecture

```text
React interface
  ├── Versioned NovaDesk brand pack + custom demo terms/evidence
  ├── Review engine: deterministic matches + disclosed heuristics
  ├── Findings with approved source IDs and versions
  ├── Creator/reviewer demo workflow + version history
  └── sessionStorage for synthetic demo state
```

`src/model.ts` contains typed records and the fictional seed pack. `src/review.ts` contains the review checks. `src/App.tsx` contains the interactive workflow and browser-session state. `src/review.test.ts` covers the sample findings, clean content, retired sources, asset review and evidence expiry. The GitHub Pages workflow in `.github/workflows/deploy.yml` builds and publishes the Vite output from `main`.

This architecture gives judges a usable public link with only a GitHub account. It deliberately does not claim hosted AI, real collaboration or production security. The earlier Round 1 proposal considered Next.js, Supabase and a hosted LLM; this implementation uses React/Vite, GitHub Pages and local rules because those other services were not available to the team during this build.

## Privacy, security and accessibility

- Sample content is fictional. Do not put confidential brand material in this public demo.
- Draft text, image previews, source edits, comments and decisions are stored in this tab’s `sessionStorage`. The app has no backend, tracking service, analytics SDK or external AI call. Font files are not loaded from an external service.
- Uploads are limited to PNG/JPEG/WebP under 750 KB. SHA-256 is used for file identity only; it does not establish visual correctness or asset ownership.
- Findings distinguish rule matches, review suggestions and evidence-needed claims. The app does not call an unverified claim false. Human decisions remain visible in the demo timeline.
- Fields have labels, keyboard-focus styles and image-alt guidance. Decorative images can be marked as such. Automated accessibility audit and assistive-technology testing remain future work.

## Known limits

- Browser role switching is a labelled simulation. Anyone using the tab can change personas. There are no real user accounts or server-side access checks.
- Session data is local to a tab, is not shared across devices and may be unavailable if the browser blocks storage. It is not a secure system of record.
- Text checks use rules and heuristics, not an AI model. They may miss nuanced tone, paraphrased claims, visual misuse or inaccurate alt text. A current, reviewer-entered evidence phrase is accepted without verifying the underlying reference.
- Uploaded image checks use file fingerprint and metadata. There is no visual classifier. PDF/DOCX extraction and external integrations are not implemented.
- The product has not been tested with real organisations or real confidential content. The issue counts are demo-session signals, not population-level insights.

## External components and AI disclosure

This project uses React, React DOM, Vite, TypeScript, Vitest, Prettier, pnpm and GitHub Pages/Actions. The code and illustration in this repository were created for this project; no Inkloom repository code or pre-existing product template was copied. **OpenAI Codex significantly assisted with architecture, code, UI styling, tests and documentation under Manas Jain’s direction.** There is no AI model inside the running product.

The initial local implementation was created on **26 October 2026 before the 10:00 AM IST Round 2 opening stated in the team email**. Git timestamps should remain unaltered. The team should verify with the organisers whether work created at this time is eligible before representing it as Round 2 build-window work. The project must not be presented as though it began later.

Individual contributions should be recorded from each member’s actual work before submission. This repository does not claim that Mayank kumar authored the current implementation.

## Proposed Round 3 additions

1. A grounded AI review mode for nuanced tone and claims, showing retrieved evidence and uncertainty alongside the existing deterministic checks.
2. Real authenticated workspaces, role-based server permissions and shared audit history so separate people can collaborate securely.
3. PDF/DOCX extraction with page or paragraph references, letting teams review real document drafts before publication.
