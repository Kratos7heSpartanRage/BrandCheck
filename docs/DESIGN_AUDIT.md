# BrandCheck Design Audit & Visual Redesign Blueprint

Date: 31 October 2026 (IST)  
Auditor: Senior Product Designer & Front-End Engineer  
Project: BrandCheck (CodeStar 30 Round 3 Finals)

---

## 1. Executive Summary & Audit Findings

An exhaustive audit of `app/`, `components/`, `lib/`, and existing CSS stylesheets (`app/globals.css`, `components/workspace-product.css`, `components/brandcheck/styles.css`, and route-level `<style>` blocks) revealed significant visual fragmentation and classic "AI-template / rapid-hackathon tells". 

While the underlying domain logic, database schemas, and transactional pipelines are world-class, the presentation layer suffers from disparate inline styling, emoji-based indicators, inconsistent typography, and lack of a unified design token system.

### Identified AI-Template & Legacy Hackathon Tells

| Category | Finding & Specific Code Location | Impact / Why It Fails |
|---|---|---|
| **Fragmented Styling Architecture** | `app/globals.css` is completely unimported; `app/layout.tsx` imports legacy `styles.css`; `app/page.tsx`, `app/documents/page.tsx`, and `app/policy-lab/page.tsx` rely on minified raw `<style>` blocks. | No centralized token cascade. Modifying colors or radii requires editing 4 separate stylesheets and inline strings. |
| **Emoji-Heavy Visual Hierarchy** | "✨ Applied 5 terminology corrections", "📜 View Clearance Certificate", "🖨️ Print", "📋 Copy", "🏆 Approved", "⏳ Awaiting", "✏️ In Progress", "✅ Terminology Clean", "⚠️ Issues". | Feels like a chatbot mockup rather than a serious enterprise B2B compliance workspace (like Linear, Attio, or Stripe). |
| **Typography & Lack of Voice** | Defaults to `system-ui, Arial, sans-serif` and `Inter` throughout. No distinguished editorial serif for brand identity; no disciplined type scale. | Looks generic and unbranded. Fails to project the calm authority of an editorial and legal governance tool. |
| **Inconsistent Color & Contrast** | Competing greens (`#103f33`, `#164a34`, `#174e39`, `#235c43`, `#28594a`), neon/amber status alerts (`#fff0cf`, `#fff9e6`), harsh red diffs (`#ffe4e4`). | High visual noise; lacks consistent semantic intent. Light mode has slight contrast dips; dark mode is partially defined but inconsistently applied across custom CSS. |
| **Border Radii & Elevation** | Inconsistent mix of `border-radius: 5px`, `7px`, `8px`, `9px`, `10px`, `12px`, `14px`, `18px`, `20px`. Heavy blur shadows (`box-shadow: 0 24px 80px #163f3012`). | Clutters the interface. Real SaaS products (Linear, Notion) adhere to strict 4px/6px/10px radii tokens with hairline borders. |
| **Landing Page Hero Structure** | `app/page.tsx` features a split hero with an artificial preview card ("A finding you can act on.") rather than an authentic frame of the real product. | Looks like an AI marketing page rather than showing the real, functional application. |

---

## 2. Design Direction: "Quiet Editorial Tool"

We commit to a single, disciplined aesthetic: **The Editorial Publishing Desk**.
Think of a hybrid between **Linear's spatial precision**, **Stripe Dashboard's dense legibility**, and **The New York Times / Notion's editorial calm**.

### Core Tenets:
1. **Neutral Surfaces & Hairline Borders:**
   - Crisp, warm neutral canvas (`#fbfbfa` in light mode, `#121312` in dark mode).
   - Flat surfaces using subtle 1px border dividers (`#e5e7e4` / `#232523`) instead of heavy artificial drop shadows.
   - Elevation shadows reserved exclusively for floating dialogs, dropdowns, and modals.
2. **Restrained Color Palette:**
   - **Single Accent:** Deep Editorial Forest Ink (`#1a4332` light / `#4ade80` dark subtle accent).
   - **Semantic Indicators:** Strict, desaturated, accessible functional colors (Subdued Sage for Approved, Warm Ochre for Needs Review/Changes, Muted Rose for Danger/Dismissed).
   - **Zero Gradients / Zero Glowing Blobs:** No gradient text, no animated backdrop glows, no glassmorphism overlays.
3. **Typography Scale with Hierarchy:**
   - **Display & Headings:** Editorial Serif font family (`Newsreader`, `Source Serif 4`, or `Fraunces` via Google Fonts with system fallback `Georgia, "Times New Roman", serif`).
   - **User Interface & Controls:** Crisp Modern Sans (`Instrument Sans`, `Geist`, or `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`).
   - **Code, Hashes & Provenance:** Precision Mono (`JetBrains Mono`, `ui-monospace, "SF Mono", monospace`).
4. **Predictable Border Radii:**
   - **4px (`--radius-sm`):** Badges, status chips, mono citations, form inputs.
   - **6px (`--radius-md`):** Buttons, content queue items, table rows, finding cards.
   - **10px (`--radius-lg`):** Modals, dialog cards, clearance certificate sheet.
5. **Tone & Microcopy:**
   - Strip all marketing fluff ("revolutionary", "magic", "seamless", "powered by AI").
   - Replace emoji with sharp 16px/1.5-stroke Lucide line icons or clean typographic status dots.
   - Use direct, accountable imperative verbs: *"Run review"*, *"Send for approval"*, *"Request changes"*, *"Approve revision"*.

---

## 3. Unified Design Tokens

All tokens are anchored on `:root` and remapped for `.dark` / `prefers-color-scheme: dark`.

```css
:root {
  /* Surfaces & Canvas */
  --bg-app: #fbfbfa;
  --bg-surface: #ffffff;
  --bg-surface-raised: #f4f5f2;
  --bg-surface-sunken: #f0f2ee;

  /* Borders & Dividers */
  --border-subtle: #e6e8e4;
  --border-strong: #d2d6d0;
  --border-focus: #1a4332;

  /* Typography Colors */
  --text-main: #141715;
  --text-muted: #5a625c;
  --text-subtle: #879089;
  --text-inverse: #ffffff;

  /* Editorial Accent */
  --accent-primary: #1a4332;
  --accent-primary-hover: #133326;
  --accent-surface: #edf3f0;
  --accent-ring: rgba(26, 67, 50, 0.25);

  /* Review Semantics (Desaturated & Accessible) */
  --status-draft-bg: #f0f2ee;
  --status-draft-text: #4e5650;
  --status-draft-border: #d8ded6;

  --status-review-bg: #f0f4fa;
  --status-review-text: #264a7f;
  --status-review-border: #c4d4eb;

  --status-warn-bg: #fdf6ec;
  --status-warn-text: #7c4b12;
  --status-warn-border: #edd6b6;

  --status-approved-bg: #edf6f0;
  --status-approved-text: #1e5631;
  --status-approved-border: #bfe0ca;

  --status-danger-bg: #fdf2f2;
  --status-danger-text: #8c2323;
  --status-danger-border: #f0c4c4;

  /* Source Highlight Tokens */
  --highlight-term: #fef08a;
  --highlight-claim: #fed7aa;
  --highlight-tone: #e9d5ff;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* Font Families */
  --font-display: "Newsreader", "Source Serif 4", Georgia, serif;
  --font-sans: "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
}

.dark {
  --bg-app: #0f1110;
  --bg-surface: #161817;
  --bg-surface-raised: #1d201e;
  --bg-surface-sunken: #111312;

  --border-subtle: #272a28;
  --border-strong: #383c39;
  --border-focus: #4ade80;

  --text-main: #f0f2f0;
  --text-muted: #9fa7a1;
  --text-subtle: #6e7570;
  --text-inverse: #0f1110;

  --accent-primary: #34d399;
  --accent-primary-hover: #10b981;
  --accent-surface: #13271f;
  --accent-ring: rgba(52, 211, 153, 0.25);

  --status-draft-bg: #1c1f1d;
  --status-draft-text: #a1aaa2;
  --status-draft-border: #323734;

  --status-review-bg: #142136;
  --status-review-text: #93b7eb;
  --status-review-border: #223758;

  --status-warn-bg: #2d1f11;
  --status-warn-text: #e0a35c;
  --status-warn-border: #4d361e;

  --status-approved-bg: #11281a;
  --status-approved-text: #7ad196;
  --status-approved-border: #1e452c;

  --status-danger-bg: #2d1414;
  --status-danger-text: #e88585;
  --status-danger-border: #4e2222;

  --highlight-term: #423b0c;
  --highlight-claim: #442a12;
  --highlight-tone: #331f4a;
}
```

---

## 4. Execution Plan & Phasing

1. **Phase 1: Design Tokens & Typography Foundation**
   - Inject web font definitions (`Newsreader` serif, `Instrument Sans` sans, `JetBrains Mono` mono) into `app/layout.tsx`.
   - Update `app/globals.css` with the complete token architecture, typography classes, status chip standards, and button/input primitives.
   - Import `globals.css` into `app/layout.tsx` so all routes inherit the single source of truth.

2. **Phase 2: Redesigning the Landing Page (`app/page.tsx`)**
   - Clean, left-aligned editorial hero with Newsreader headline.
   - Frame a real interactive preview of the review screen with authentic finding quotes.
   - 4 honest narrative sections: Workflow, Source Grounding, Model Boundaries, and CodeStar 30 footer.
   - Elegant SVG wordmark with no robotic sparkles.

3. **Phase 3: The Workspace Shell & App Layout (`components/WorkspaceProduct.tsx` & `workspace-product.css`)**
   - 240px structured sidebar with Lucide 16px outline icons.
   - Crisp table/split-view layout replacing card clumps.
   - Modernized status pills (dot + label, calm tones).
   - Clean editorial typography for headings, breadcrumbs, and stats.

4. **Phase 4: The Core Review Experience**
   - Monospace quote cards with inline text highlights.
   - Redesigned visual leads panel (neutral, professional review callouts with mandatory confirmation reason).
   - Calm, non-alarmist AI fallback notice.
   - Crisp diffs (clean strike-through / green additions).
   - Redesigned clearance certificate sheet with printable styling.

5. **Phase 5: Sub-Pages Polish**
   - `/documents`: Clean 2-column layout, WCAG AA/AAA contrast badges, refined auto-contrast optimizer.
   - `/policy-lab`: Structured table and proposal diffs.
   - `/example`: Harmonize header and container tokens with the editorial theme.

6. **Phase 6: Verification & QA**
   - Run Python logic/bracket test suite.
   - Verify zero regressions on business logic or API routes.
   - Document visual test record in `docs/TESTING.md`.
