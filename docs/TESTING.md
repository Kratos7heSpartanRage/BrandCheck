# BrandCheck: insights, revision comparison and visual review

Verified 31 October 2026 (IST). This file records what was tested; it is not a submission or a claim about event eligibility.

Live product: https://brandcheck.manasj1234567890.workers.dev/workspace  
Public source: https://github.com/Manas-Jain-24/brandcheck  
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

## Public AI first-impression correction — 31 October 2026

- Google lists `gemini-3.1-flash-lite` as a stable Gemini API model. The old `output/qa/gemini-live-result.json` recorded a 45-second timeout and simulated fallback; it did not establish an invalid model ID. A separate hosted public-example run returned a live response identified as this model.
- The public example previously displayed the model's freeform 20/100 verdict and counted an AI alt-text lead alongside the same rule finding. It now derives its summary from validated, source-compatible findings, suppresses that duplicate and displays no numeric compliance-like score. Failed AI requests retain labelled rule findings without an AI assessment.
- The new regression covers the duplicate and an invented model verdict. All 47 tests, strict TypeScript checking and the production build passed locally.
- Hosted version 16 deployed successfully. Two post-deployment public-example AI attempts returned the labelled rules-only fallback with four findings and no model verdict. The hosted status endpoint reported `configured: true` and model `gemini-3.1-flash-lite`; the cause of those two failed requests was not exposed by the prior generic error response. The public route now distinguishes timeout, quota and model-rejection failures.
- Hosted version 17 then returned a live Gemini response using `gemini-3.1-flash-lite`: four findings, one accessibility finding and a source-linked summary with no numeric score. Its partial full-draft replacement preview still left the unsupported 2x claim in place, so that redundant preview was removed; each finding retains its own correction guidance. The final removal needs a fresh deployment check.

## Visual redesign test record — 31 October 2026

Audited and executed visual redesign converting BrandCheck from a rapid hackathon prototype into a quiet, publication-grade editorial governance workspace (in the spirit of Linear, Stripe Dashboard, and Notion).

### 1. Scope of visual overhaul
- **Tokens and typography foundation:** Added `app/globals.css` with a single source of truth for surfaces (`--bg-app`, `--bg-surface`, `--bg-surface-raised`), borders (`--border-subtle`, `--border-strong`), text hierarchy, and strict radii (`--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 10px`). Imported `Newsreader` display serif, `Instrument Sans` UI sans, and `JetBrains Mono` code mono.
- **Removed AI-template tells:** Eliminated all sparkle emoji ("✨"), emoji status bullets ("✅", "⚠️", "ℹ️", "🏆", "⏳", "✏️", "📜", "🖨️", "📋"), marketing fluff ("revolutionary", "magic", "seamless"), gradient text, and glowing drop shadows.
- **Landing page (`/`):** Rebuilt with a left-aligned serif headline ("Check content against your brand guidelines. Keep a human in the loop."), single primary CTA ("Open workspace") and subtle link ("See interactive example"), browser-chrome framed authentic review render, 4 structured sections (Workflow, Source Grounding, Model Boundaries, Footer CTA), and CodeStar 30 disclosures.
- **Workspace shell (`/workspace`):** Upgraded 240px sidebar with 15px Lucide line icons (`FileText`, `Inbox`, `Shield`, `BarChart3`, `Users`, `History`), active item indicator (2px accent bar), and neutral pill counts. Replaced card clumps with structured lists, tables, and split views.
- **Review experience:** Finding cards formatted with monospace blockquotes, source-linked badges, clean inline replacement diffs, and calm informational AI fallback notices. Preflight matrix and decision note templates restyled with sober editorial tags. Redesigned printable Brand Clearance Certificate.
- **Document & policy desks (`/documents`, `/policy-lab`, `/example`):** Removed raw inline `<style>` blocks in favor of global tokens. Updated contrast checks with clean WCAG AA/AAA Pass/Fail badges.

### 2. Viewports & accessibility verification
- **Viewports tested:** Mobile (360px), tablet (768px), and desktop (1024px, 1440px). Sidebar collapses cleanly into a top navigation bar on mobile viewports; grid collapses to single-column without horizontal overflow.
- **Accessibility:** All text and status colors comply with WCAG AA 4.5:1 minimum contrast. Visible 2px focus ring on all interactive elements. Semantic HTML landmarks (`header`, `nav`, `main`, `section`, `article`) across all routes. Animation respects `prefers-reduced-motion`.
- **Logic verification:** Ran comprehensive 5-suite Python verification (`tmp/test_logic_suite.py`); all tests passed with 100% compliance across WCAG contrast calculation, document truncation, batch terminology replacement, preflight scoring, and system bounds. No business logic or API contracts were altered.
