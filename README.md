# BrandCheck — hosted judge demo

This project hosts BrandCheck and its Gemini review endpoint together. Judges can open the app, review the fictional NovaDesk sample, revise content and record a human approval without signing in or supplying a key.

The React review interface is adapted from Manas-Jain-24/brandcheck, commit 9832996. The hosted version adds a server route, private runtime secrets, validated inputs/outputs, durable usage limits and isolation of asynchronous review results.

## Architecture

Browser → POST /api/review → private runtime GEMINI_API_KEY → Google Gemini.

The server filters retired sources and expired evidence, bounds request size, validates the returned assessment and limits shared demo usage. AI findings must quote content present in the input and cite an active source. This is structural grounding, not proof that the source supports every interpretation. The public review desk retains browser-session drafts. A separate `/workspace` screen adds platform sign-in, D1-backed shared drafts, explicit email membership, server-enforced admin/creator/reviewer roles and server-recorded audit events. Submitting freezes a revision and saves rule findings and the current workspace policy. The API rejects self-review, cross-workspace access and stale updates. Editing an approved draft returns it to draft status while retaining the original decision.

## Product journeys

- `/`: public text/image review, live Gemini with rule fallback, source explanations, optional corrections and clearly simulated reviewer decisions. No key or sign-in required.
- `/documents`: local PDF/DOCX/TXT/Markdown extraction, editable page/paragraph text, source-linked rule findings with location links, contrast checks and text handoff to a shared workspace. The two-page example is explicitly synthetic. Actual PDF/DOCX import is supported.
- `/policy-lab`: a clearly labelled device-local policy regression sandbox for anonymous judges. Propose a rename, inspect differences, activate it and see which sample draft requires re-review.
- `/workspace`: real authenticated shared drafts, comments, review decisions, custom JSON brand policies, admin-approved updates, bounded workspace-wide rechecks and stored history. GitHub raw policy import is a real read-only, on-demand connector. It creates a proposal; it does not automatically activate an external policy.

## Shared-review integration contract

`GET /api/workspaces` returns the authenticated user and accessible workspaces. `GET /api/workspaces?workspaceId=<id>` returns the role, drafts, members and latest events. Anonymous callers receive 401; inaccessible workspaces return 404.

`POST /api/workspaces` accepts JSON actions: `createWorkspace`, `invite`, `createDraft`, `saveDraft`, `submit`, `recheckDraft`, `comment`, `decide`, `proposePolicy`, `syncPolicy`, or `decidePolicy`. Existing-draft actions require `workspaceId`, `draftId` and current `version`; create/save requires `title` and `body`. Decisions require `decision: approved|changes_requested` and a nonempty `note`. Policy proposals carry the pack; sync carries a public `https://raw.githubusercontent.com/...` URL; a policy decision carries `proposalId`, `accept` and `note`. See `lib/shared-review.ts` for the Zod contract. Writes require same-origin Origin. Identity comes from the platform's server context, never submitted JSON. Grant access to a teammate's exact sign-in email, then share the /workspace link; no invitation email is sent.

State mutations and audit events commit atomically in D1 batch transactions. Compare-and-swap version checks and a unique mutation token prevent false events from conflicting writes. Audit events have no edit/delete API; database administrators remain trusted. This is not a cryptographically signed or administrator-proof ledger.

Policy activation and all matched draft rechecks use one five-statement transaction with JSON1 and per-draft revision guards. A concurrently edited draft is skipped rather than overwritten; its policy mismatch is visible and an explicit recheck recovers it. A stale policy proposal cannot overwrite a newer version. Regression output is limited to 700 KB per activation. The database retains old/new policy payloads in audit history.

Shared tables store member emails, actor identity, draft text, revision snapshots and comments. Every workspace member can read its contents. Use synthetic content for evaluation. Queue and displayed history are bounded to 100 drafts and the latest 200 events. Document originals are not uploaded or stored. Only an explicit handoff sends extracted text to shared storage, subject to the 5,000-character shared editor limit.

Run `node scripts/test-shared-review.mjs` on Node 22.13+ for SQLite-backed tests of the actual service and migrations. The current suite has 23 cases covering permissions, concurrent writes, policy rejection/activation/rollback, rechecks, actual DOCX extraction, contrast and AI excerpt/citation validation. `node scripts/create-document-fixtures.mjs` generates a real two-page test PDF in ignored `work/`. Local browser QA covered actual PDF and DOCX extraction, page-2 findings, extracted-text handoff, policy proposal/activation and changed draft status. Local preview uses the starter's development identity facility; two real hosted accounts must still verify production sign-in and shared decisions.

## Runtime configuration

Configure GEMINI_API_KEY as a secret in Sites settings. GEMINI_MODEL defaults to gemini-3.1-flash-lite. Never put a key in client code, a VITE_ variable, Git, or hosting.json.

The source hosting manifest declares the DB binding. Sites applies the checked-in D1 migration before deployment. The live endpoint is limited to 60 requests per UTC day across the demo and 12 requests per visitor IP bucket per 10 minutes. Old buckets expire after two days. Raw addresses and draft text are not stored by the endpoint.

## Run and build

Use Node.js 22+ and pnpm 11.25.0. Install with the Sites installation helper, then run pnpm dev. Build with the Sites build helper so Worker metadata is generated correctly. pnpm exec tsc --noEmit checks application types. pnpm run db:generate creates an additive migration when schema changes.

The app uses the Sites Vinext starter, Vite, React, TypeScript, Cloudflare Workers/D1, Zod, Drizzle and Google Gemini. PDF.js (Apache-2.0), Mammoth (BSD-2-Clause) and fflate (MIT) provide document parsing and ZIP inspection. The upstream PDF worker is copied from the installed package into a generated public asset before dev/build, retaining its licence notice. The hosting starter is reused infrastructure; the brand-governance workflow is project code. AI coding assistance was used for implementation and debugging.

## Privacy and limitations

Hybrid mode sends draft text, image metadata, approved guidelines and evidence references through the server to Google Gemini. Image pixels are not sent. The API key remains a runtime secret. Local rule checks can be used without an AI request. AI findings and scores can be wrong and require human review. Model availability and demo quotas may temporarily limit live review.

## Known limitations and scope changes

- Shared workspaces currently use deterministic rule checks; live AI is in the public review desk. Shared document handoff saves extracted text and does not retain page mappings on the server.
- PDF support is text-based, up to 20 pages/5 MB/40,000 extracted characters. DOCX locations are extracted paragraphs, not original Word page/line coordinates. No OCR, pixel-coordinate overlays, presentation-deck or Figma parsing. Unsupported/encrypted/empty documents show an error. The document screen displays at most 200 findings with an explicit truncation notice.
- Visual functionality is exact asset hashing/alt-text checks in the public review desk and explicit foreground/background contrast measurement in Documents. No vision classifier, logo clearance or automatic palette inspection is claimed.
- The promised policy-platform connector scope was narrowed to public GitHub JSON, because the team already uses GitHub. No Notion, Confluence, Google Docs or Webflow integrations; no private-repository authentication, background sync or external published-content crawler.
- Policy JSON is explicitly structured. Free-text policy memos are not automatically converted into reliable rules. Claim/tone heuristics use known policy identifiers from the example schema; adding arbitrary prose does not create a new automatic detector.
- Audit events are application-append-only with trusted database administration, not a cryptographically signed ledger or evidence of SOC2 certification. No Slack/Teams/email notifications, member removal, retention/export/deletion administration or enterprise security certification.
- Policy freshness is checked on activation, submission or explicit recheck; there is no scheduled expiry sweep. Source correctness, user-entered evidence and claim truth are not independently verified.
- The original anonymous review desk and policy sandbox have clearly labelled local state/persona simulation; shared workspaces require real sign-in. The application is an MVP with documented limits, not a guarantee of legal or brand compliance.
