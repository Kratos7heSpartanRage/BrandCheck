# BrandCheck — hosted judge demo

This project hosts BrandCheck and its Gemini review endpoint together. Judges can open the app, review the fictional NovaDesk sample, revise content and record a human approval without signing in or supplying a key.

The React review interface is adapted from Manas-Jain-24/brandcheck, commit 9832996. The hosted version adds a server route, private runtime secrets, validated inputs/outputs, durable usage limits and isolation of asynchronous review results.

## Architecture

Browser → POST /api/review → private runtime GEMINI_API_KEY → Google Gemini.

The server filters retired sources and expired evidence, bounds request size, validates the returned assessment and limits shared demo usage. The public review desk retains browser-session drafts. A separate `/workspace` screen adds platform sign-in, D1-backed shared drafts, explicit email membership, server-enforced admin/creator/reviewer roles and server-recorded audit events. Submitting freezes a revision and saves rule findings and approved NovaDesk demonstration sources. The API rejects self-review, cross-workspace access and stale updates. Editing an approved draft returns it to draft status while retaining the original decision.

## Shared-review integration contract

`GET /api/workspaces` returns the authenticated user and accessible workspaces. `GET /api/workspaces?workspaceId=<id>` returns the role, drafts, members and latest events. Anonymous callers receive 401; inaccessible workspaces return 404.

`POST /api/workspaces` accepts JSON actions: `createWorkspace`, `invite`, `createDraft`, `saveDraft`, `submit`, `comment`, or `decide`. Existing-draft actions require `workspaceId`, `draftId` and current `version`; create/save requires `title` and `body`. Decisions require `decision: approved|changes_requested` and a nonempty `note`. See `lib/shared-review.ts` for the Zod contract. Writes require same-origin Origin. Identity comes from the platform's server context, never submitted JSON. Grant access to a teammate's exact sign-in email, then share the /workspace link; no invitation email is sent.

State mutations and audit events commit atomically in D1 batch transactions. Compare-and-swap version checks and a unique mutation token prevent false events from conflicting writes. Audit events have no edit/delete API; database administrators remain trusted. This is not a cryptographically signed or administrator-proof ledger.

Shared tables store member emails, actor identity, draft text, revision snapshots and comments. Every workspace member can read its contents. Use synthetic content for evaluation. This slice does not yet support custom policy packs, live AI in shared revisions, PDF/DOCX intake, policy sync, notifications, member removal, retention or deletion administration. Queue and history are currently bounded to 100 drafts and the latest 200 events. It is not an enterprise-ready confidential document service.

Run `node scripts/test-shared-review.mjs` on Node 22.13+ for 11 SQLite-backed tests of the actual service and migrations. These cover roles, organization isolation, self-review, stale/concurrent writes, findings snapshots and transaction rollback. Local preview uses the starter's development identity facility; two real hosted accounts must still verify production sign-in and shared decisions.

## Runtime configuration

Configure GEMINI_API_KEY as a secret in Sites settings. GEMINI_MODEL defaults to gemini-3.1-flash-lite. Never put a key in client code, a VITE_ variable, Git, or hosting.json.

The source hosting manifest declares the DB binding. Sites applies the checked-in D1 migration before deployment. The live endpoint is limited to 60 requests per UTC day across the demo and 12 requests per visitor IP bucket per 10 minutes. Old buckets expire after two days. Raw addresses and draft text are not stored by the endpoint.

## Run and build

Use Node.js 22+ and pnpm 11.25.0. Install with the Sites installation helper, then run pnpm dev. Build with the Sites build helper so Worker metadata is generated correctly. pnpm exec tsc --noEmit checks application types. pnpm run db:generate creates an additive migration when schema changes.

The app uses the Sites Vinext starter, Vite, React, TypeScript, Cloudflare Workers/D1, Zod, Drizzle and Google Gemini. The hosting starter is reused infrastructure; the brand-governance workflow is project code. AI coding assistance was used for implementation and debugging.

## Privacy and limitations

Hybrid mode sends draft text, image metadata, approved guidelines and evidence references through the server to Google Gemini. Image pixels are not sent. The API key remains a runtime secret. Local rule checks can be used without an AI request. AI findings and scores can be wrong and require human review. Model availability and demo quotas may temporarily limit live review.
