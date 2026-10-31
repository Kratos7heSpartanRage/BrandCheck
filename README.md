# BrandCheck

> Editorial governance and brand compliance workspace with source-grounded verification and human-in-the-loop approvals.

- **Live Product:** [https://brandcheck-codestar-judge.freelynx19.chatgpt.site](https://brandcheck-codestar-judge.freelynx19.chatgpt.site)
- **Source Repository:** [https://github.com/Manas-Jain-24/brandcheck](https://github.com/Manas-Jain-24/brandcheck)
- **Documentation:** [CodeStar 30 Requirements](HACKATHON.md) · [Round 2 Submission](docs/BrandCheck_Round_2_Submission.pdf) · [Round 3 Finals Report](docs/BrandCheck_Round_3_Finals.pdf) · [Verification & Test Record](docs/TESTING.md)

---

### ⚡ 60-Second Judge Fast-Track

Judges evaluating the live deployment independently can follow these three primary paths:
1. **Interactive Demo Desk ([/example](https://brandcheck-codestar-judge.freelynx19.chatgpt.site/example)):** Instant, zero-login evaluation. Inspect real-time findings against the NovaDesk brand pack, test one-click batch terminology replacements, inspect preflight scores, and switch to reviewer mode.
2. **Document Intake Desk ([/documents](https://brandcheck-codestar-judge.freelynx19.chatgpt.site/documents)):** Upload native text-based **PDF** or **Word (.docx)** files. Verify paragraph/page-linked findings, test the interactive WCAG 2.2 color contrast optimizer, and test document handoff.
3. **Multi-Tenant Workspace ([/workspace](https://brandcheck-codestar-judge.freelynx19.chatgpt.site/workspace)):** Authenticated enterprise collaboration. Enforces server-side RBAC (Admin, Creator, Reviewer), anti-self-approval protection, optimistic concurrency (CAS), revision diffs, and audit trail.

---

## Overview

BrandCheck is an editorial review and brand governance platform designed to help teams inspect, verify, and approve content before publication against authoritative brand guidelines. 

Unlike generic grammar checkers or ungrounded AI text generators, BrandCheck enforces strict **source-grounded validation**: every identified issue cites approved brand policy text, provides a persistent rule identifier, and keeps human reviewers in control of all final publication decisions.

---

## Core Product Capabilities

1. **Brand Guidelines & Policy Engine**  
   Define authoritative positioning, tone criteria, approved/retired terminology, and claim evidence. Policy changes follow a formal proposal lifecycle with review and administrative approval.

2. **Multi-Format Document Intake**  
   Native client-side text and structure extraction for **PDF**, **Word (.docx)**, **Markdown**, and plain text. Retains page and paragraph location mappings so reviewers can trace findings directly back to specific document sections. Original files remain local to the user's device.

3. **Source-Grounded Verification Engine**  
   Combines high-speed deterministic pattern checks with semantic analysis (`gemini-3.1-flash-lite`). Every finding references an active brand rule (e.g. `TERM-001`, `CLAIM-001`), quotes the offending passage, and provides contextual replacement suggestions. If external APIs time out or encounter rate limits, BrandCheck gracefully defaults to local rule verification without breaking workflow continuity.

4. **Visual Asset Governance**  
   Enforces visual guidelines across attached graphics: validates alt text, matches exact SHA-256 asset fingerprints against approved media libraries, and computes dominant color heuristics against brand palettes. An optional visual review flow generates candidate leads that must be explicitly confirmed or dismissed by an authorized reviewer.

5. **Human Approval Workflow & Role Separation**  
   Maintains strict separation between content creators and reviewers. The server prevents self-approval and restricts decisions to designated reviewers. Any subsequent edit to an approved draft automatically invalidates prior approval status and triggers a re-check requirement.

6. **Policy Impact & Governance Insights**  
   When brand guidelines are updated, BrandCheck automatically scans existing drafts and flags impacted content for re-review. Workspace analytics highlight recurring policy gaps, clearance rates, and reviewer outcome trends across team history.

---

## Application Structure & Routes

- **`/` (Landing Page):** Product overview, workflow breakdown, and an interactive review preview framed with real highlighted findings.
- **`/workspace`:** Authenticated collaborative workspace with multi-draft management, reviewer inbox, brand guideline management, team permissions, and audit logs.
- **`/example`:** Fully functional interactive sandbox running sample brand guidelines (NovaDesk) without requiring sign-in or API keys.
- **`/documents`:** Standalone document analysis desk supporting PDF and Word (.docx) files with page-level finding navigation and workspace export.
- **`/policy-lab`:** Interactive brand policy simulator for testing rule modifications against sample content before rolling them out to a team.

---

## Architecture & Data Flow

```
[ Browser Client ]
        │
        ▼ (Same-Origin JSON Actions)
[ Cloudflare Workers Edge API ]
        │
        ├──▶ [ Cloudflare D1 Database (SQLite + Drizzle ORM) ]
        │       • Workspace membership & RBAC
        │       • Versioned drafts & paragraph location maps
        │       • Approved brand policies & pending proposals
        │       • Append-only audit events
        │
        └──▶ [ Google Gemini API (`gemini-3.1-flash-lite`) ]
                • Semantic guideline evaluation
                • Grounded source citation
                • Graceful fallback to deterministic rule engine
```

### Key Technical Decisions

- **Full-Stack Edge Deployment:** Built with React 19, TypeScript, and Vite on Cloudflare Workers for fast global response times.
- **Data Persistence:** Cloudflare D1 provides transactional SQLite storage. Additive migrations are managed with Drizzle ORM.
- **Client-Side Document Parsing:** Uses `pdfjs-dist` for PDF extraction, `mammoth` for DOCX XML conversion, and `fflate` for lightweight ZIP decompression. Document binaries are parsed locally in the browser to maintain privacy and reduce payload overhead.
- **Type Safety:** Zod schemas validate all client requests, workspace actions, and model responses at runtime.
- **Audit Logging:** Every state transition (draft save, submission, review decision, policy change) records an append-only audit event with timestamps, actor IDs, and policy version snapshots.

---

## Workspace API Contract

The workspace backend exposes a structured JSON-over-HTTP interface at `/api/workspaces`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workspaces` | Lists authenticated user identity and accessible workspaces. |
| `GET` | `/api/workspaces?workspaceId=<id>` | Retrieves drafts, members, policies, active proposals, and recent events for a workspace. |
| `POST` | `/api/workspaces` | Executes validated state actions (e.g., `createWorkspace`, `saveDraft`, `submit`, `decide`, `proposePolicy`, `decidePolicy`). |

All mutations require the current draft/policy revision number to prevent stale writes, enforce identical-origin headers, and return standard HTTP status codes (`401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`).

---

## Getting Started & Local Development

### Prerequisites

- Node.js 22+
- pnpm 11+

### Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Manas-Jain-24/brandcheck.git
   cd brandcheck
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Configure environment variables (optional for local mock preview):
   ```bash
   # Private runtime key for semantic analysis
   export GEMINI_API_KEY="your-gemini-api-key"
   export GEMINI_MODEL="gemini-3.1-flash-lite"
   ```

### Development & Build Commands

- **Start local dev server:**
  ```bash
  pnpm dev
  ```
- **Type-check codebase:**
  ```bash
  pnpm exec tsc --noEmit
  ```
- **Generate database migrations:**
  ```bash
  pnpm run db:generate
  ```
- **Run automated test suite (47 service and integration tests):**
  ```bash
  node scripts/test-shared-review.mjs
  ```
- **Build production bundle:**
  ```bash
  pnpm run build
  ```

---

## Product Roadmap & Future Development Plan

BrandCheck’s architecture is deliberately designed as an extensible governance engine. The roadmap below outlines the post-finals development trajectory:

### Phase 1: Ingestion & CMS Connectors (Q1)
- **Native Document Add-ins:** Direct bi-directional plugins for **Google Docs** and **Microsoft Word 365** to surface brand guideline checks inline within authoring environments.
- **Enterprise CMS Integrations:** Automated ingestion and compliance webhooks for **Notion**, **Confluence**, and **Webflow**.
- **Serverless OCR Extension:** Client-fallback serverless Tesseract/OCR pipeline for scanned image-only PDFs and rasterized marketing collateral.

### Phase 2: Advanced Governance & Escalation (Q2)
- **Multi-Stage Approval Workflows:** Tiered approval chains routing drafts through specialized personas (e.g., *Copywriter* $\rightarrow$ *Brand Director* $\rightarrow$ *Legal Counsel*).
- **Proactive Notification Hub:** Real-time compliance alerts, revision mentions, and decision digests delivered via **Slack**, **Microsoft Teams**, and email webhooks.
- **Automated Evidence Expiry Monitoring:** Background cron workers scanning active claims and automatically alerting reviewers 30 days prior to substantiating evidence expiration.

### Phase 3: Headless Continuous Compliance (Q3)
- **BrandCheck CI/CD Linter (`brandcheck-cli`):** Standalone headless CLI tool for GitHub Actions and GitLab CI, checking Markdown docs, static site copy, and pull requests on commit.
- **Cryptographic Audit Ledger:** Signed verification hashes for compliance exports, providing verifiable zero-knowledge tamper resistance for SOC2 and ISO compliance.

---

## Technology Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend & Edge Compute:** Cloudflare Workers
- **Database & Storage:** Cloudflare D1 (Serverless SQLite), Drizzle ORM
- **Document Ingestion:** PDF.js, Mammoth (.docx), fflate
- **Analysis & Governance:** Google Gemini API (`gemini-3.1-flash-lite`) + custom deterministic rule engine
- **Validation:** Zod schemas for end-to-end type safety
