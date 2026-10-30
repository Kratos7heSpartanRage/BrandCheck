# BrandCheck

BrandCheck connects approved brand guidelines, content review and human approvals in a saved workspace.

Product: https://brandcheck-codestar-judge.freelynx19.chatgpt.site  
Deployed source branch: https://github.com/Manas-Jain-24/brandcheck/tree/judge-hosted

[CodeStar 30 links and requirements](HACKATHON.md) · [Latest validation record](docs/TESTING.md)

## Main product flow

1. Sign in and create a workspace. New workspaces start with generic claim/tone guidance and no fictional brand facts. NovaDesk example data is an explicit opt-in.
2. Use Brand guidelines to define positioning, tone, retired/preferred names and evidence. Changes become proposals; an admin approves or rejects them.
3. Write content or import PDF/DOCX/TXT/Markdown directly into the content editor. Attach a PNG/JPEG/WebP image with alt text, a client-side SHA-256 fingerprint and a small metadata-stripped preview. Save text, image metadata and page/paragraph location maps. Original files remain on the device.
4. Run rules or consent to live Google Gemini text review. Separately consent to send a small saved image preview for visual AI review. Findings, source references, model identity, source-linked priority and fallback status are saved with the revision. Visual AI observations are stored as unverified leads outside the finding count; a separate reviewer may confirm or dismiss each with a reason after checking the original image. Tentative OCR stays in a collapsed panel. AI prose is not accepted as a freeform compliance verdict; saved summaries are derived from validated findings. Corrections remain optional and need a new saved review.
5. Assign a workspace reviewer and submit the saved revision. The reviewer inbox shows assigned and unassigned submissions; a link opens the exact draft after sign-in. A separate reviewer comments, requests changes or approves with a reason. The server denies self-review and decisions by the wrong assigned reviewer. Revising approved content invalidates its approval.
6. Approved policy changes recheck stored content and mark affected decisions/submissions for review. Original proposal differences and old/new policy packs remain in history.
7. Compare a working revision with a prior saved snapshot or reviewer decision. Insights summarize recurring source areas, later clearances and reviewer outcomes from bounded saved history.

The workspace has Content, Review inbox, Brand guidelines, Insights, People & access, and Activity navigation. Admins can grant and remove creator/reviewer access. Sign-in establishes identity; it never grants access to another workspace by itself. Invitations and review links are shared manually; no email is sent by the service.

## Public exploration

- `/`: product entry. Signed-in visitors go directly to `/workspace`.
- `/workspace`: real authenticated, persistent collaboration.
- `/example`: a working fictional NovaDesk example without sign-in or a visitor-supplied API key. Its creator/reviewer selector is explicitly local simulation. It is separate from real workspace permissions.
- `/documents`: browser-local document review against example guidelines, with text/location-map handoff to a saved workspace.
- `/policy-lab`: clearly labelled device-local policy-change example. Real saved policies and permissions live in `/workspace`.

## Architecture and data

React/TypeScript and the Sites Vinext/Vite starter run on Cloudflare Workers. D1 stores workspace membership, drafts, document location maps, findings, review metadata, policy proposals/versions and audit events. Zod validates requests and AI output. Drizzle owns additive schema migrations. No runtime request creates database tables.

Browser → same-origin workspace API → private runtime key → Google Gemini. Shared AI reads the authoritative saved draft and approved workspace policy on the server. It checks membership, content revision and policy again before committing results. Late results cannot overwrite newer content/policies; revoked members cannot save a completed long-running review. State mutations and their events are batched transactions. Policy rechecks use a bounded five-statement transaction with JSON1 and per-draft revision guards.

PDF.js (Apache-2.0), Mammoth (BSD-2-Clause) and fflate (MIT) provide parsing and ZIP inspection. The upstream PDF worker is copied to a generated static asset before dev/build with its license notice retained. Shared document findings retain page/paragraph locations after reload and policy rechecks. Editing individual sections rebuilds offsets; switching to plain text explicitly discards the map.

AI findings must quote content present in the input and cite an active source of a compatible category. Stored AI explanations quote the approved source; freeform model assessments and unsupported rewrite instructions are discarded. The saved priority and any rewrite are constructed from validated findings and direct source-linked replacements. This structural grounding does not prove the model's interpretation is correct. Failed AI analysis saves labelled rule-only results with no simulated assessment. Editing content or changing policy clears stale AI metadata. Submission preserves a matching live assessment; it does not silently replace it with a rule-only review.

Image rules compare exact fingerprints with admin-approved asset records, check alt text, and sample a graphic's dominant colour against approved hex colours. The colour test is a heuristic for graphics; photographs are excluded. Old workspaces without image guidelines receive clearly labelled built-in accessibility and policy-gap findings. Only a small browser-generated preview, fingerprint and metadata are stored in D1. Text AI never sends image pixels. A separate opt-in visual action sends only the saved reduced-size preview and approved visual sources to Gemini. Its source-linked observations remain unverified leads until an authorised reviewer confirms them. OCR may be wrong at this resolution and is never automatically counted as a finding.

Insights use the latest 100 drafts and 200 activity events returned by the workspace API. They distinguish current findings from historical review runs and reviewer outcomes. A later cleared issue may reflect editing or a policy change. Revision comparison uses saved audit snapshots and line differences; older snapshots outside the 200-event window are unavailable.

Audit events have no edit/delete API, but database administrators are trusted. This is not a signed, administrator-proof ledger or evidence of SOC2 certification.

## Policy connector

A read-only, on-demand connector fetches public JSON from `https://raw.githubusercontent.com/...`. It requires an authenticated admin, bounds the response size, rejects redirects and validates the pack. Import creates a proposal; it never activates an external change automatically. An example file is in `examples/brand-policy.json`.

The normal brand editor does not require JSON. Advanced JSON import remains available. There are no Notion, Confluence, Google Docs, Webflow or private-repository connectors and no background sync or memo-to-rule extraction.

## API contract

`GET /api/workspaces`: authenticated identity and accessible workspaces.  
`GET /api/workspaces?workspaceId=<id>`: role, drafts, members, policies, proposals and latest events.  
`POST /api/workspaces`: validated JSON actions `createWorkspace`, `invite`, `removeMember`, `createDraft`, `saveDraft`, `assignReviewer`, `reviewAI`, `reviewVisual`, `resolveVisualCandidate`, `recheckDraft`, `submit`, `comment`, `decide`, `proposePolicy`, `syncPolicy`, `decidePolicy`.

Draft mutations require the current revision. `reviewAI` and `reviewVisual` each require explicit `consent: true`; the latter sends the saved preview, not the original file. Both read the authoritative saved draft and approved pack, never caller-supplied alternate brand rules. Imported content may include a validated `document` map of ordered labelled ranges covering the text. Identity is supplied by Sites server context, never submitted JSON. Writes require the exact same-origin Origin. Anonymous calls return 401; inaccessible workspaces return 404; unauthorized actions return 403; stale mutations return 409. The body stream is limited to 96 KB.

Membership invitations grant the exact email access; no invitation email is sent. Share the workspace URL separately. The workspace owner's membership cannot be removed through the member-removal action. Removed members lose access; previous authored content and recorded history remain intact.

## Configuration and verification

Use Node 22.13+ and pnpm 11.25.0. Configure `GEMINI_API_KEY` and optional `GEMINI_MODEL` only as private runtime secrets. Current default model: `gemini-3.1-flash-lite`. Never put secrets in browser code, Git, a `VITE_` value or `.openai/hosting.json`.

- `pnpm dev`: local preview with the starter's development sign-in facility.
- `pnpm exec tsc --noEmit`: strict type checking.
- `pnpm run db:generate`: additive migration generation; inspect generated SQL/metadata.
- `node scripts/test-shared-review.mjs`: 46 SQLite-backed service/transport/document tests using actual migrations.
- `node scripts/create-document-fixtures.mjs`: real two-page PDF fixture in ignored `work/`.
- Build and publish through the Sites skill helpers to retain Worker metadata and apply production migrations.

Tests cover organization isolation, roles, self-review, assigned reviewer enforcement, revocation, stale/concurrent writes, transaction rollback, policy proposals/regression, document mapping, saved image review, real DOCX extraction, AI consent/fallback/provenance and stale AI results. Browser QA should exercise the full new-brand → imported document/image → saved review → approval journey; distinguish local, hosted and two-account results in release notes.

## Privacy and current limits

Text AI sends saved draft text and approved policy/evidence to Google through the server. Visual AI separately sends a small saved preview and approved visual sources. A user must explicitly consent to each action. Original image files and document binaries are not sent by the workspace. All workspace members can read its content; the platform supplies authentication. There is no enterprise security certification or independent external claim fact-checking.

The hosted service currently shares an AI allowance of 60 requests per UTC day and 12 per visitor-IP bucket per 10 minutes. D1 counters store rotating hashes, not raw IP addresses. Rule checks remain available when AI fails or reaches its allowance. These are operating limits, not a paid plan or unlimited service promise.

Workspace drafts support 5,000 characters, up to 100 drafts per workspace and the latest 200 displayed activity events. The document tool supports files up to 5 MB, 20 text-based PDF pages, 200 DOCX paragraphs and 40,000 extracted characters; it displays at most 200 findings with a notice. Longer documents can be locally reviewed but must be shortened before saved-workspace handoff. No scanned-document OCR, pixel-coordinate highlights, original Word page/line fidelity, presentation or Figma import is implemented.

Visual rules use exact asset hashes, alt text and a sampled dominant-colour heuristic for graphics in the saved workspace; the document tool also calculates explicit text contrast. Optional Gemini preview analysis provides tentative visual observations and OCR text. It is not a trained brand classifier, does not establish exact logo identity or clearance distance, and does not automatically assess full-image palette usage. There are in-app reviewer inbox counts and manually shared review links, but no email/Slack/Teams notifications, scheduled expiry sweeps, billing, retention/deletion administration or general history pagination. The project is a functional hackathon product with explicit limits, not a promise of legal/brand compliance or audited enterprise readiness.

## Reuse and assistance

The original review interface was adapted from Manas-Jain-24/brandcheck, commit `9832996`. The Sites Vinext starter is reused hosting infrastructure. React, Vite, TypeScript, Cloudflare, Drizzle, Zod, Gemini and the document libraries above are external components/services. Significant AI coding assistance was used for implementation, testing and debugging. Individual contribution statements must describe work each participant actually performed.
