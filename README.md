# BrandCheck — hosted judge demo

This project hosts BrandCheck and its Gemini review endpoint together. Judges can open the app, review the fictional NovaDesk sample, revise content and record a human approval without signing in or supplying a key.

The React review interface is adapted from Manas-Jain-24/brandcheck, commit 9832996. The hosted version adds a server route, private runtime secrets, validated inputs/outputs, durable usage limits and isolation of asynchronous review results.

## Architecture

Browser → POST /api/review → private runtime GEMINI_API_KEY → Google Gemini.

The server filters retired sources and expired evidence, bounds request size, validates the returned assessment and limits shared demo usage. The D1 database stores usage counters and rotating hashes only. Drafts, comments and approvals remain a browser-session demonstration; they are not shared accounts or server-enforced review roles.

## Runtime configuration

Configure GEMINI_API_KEY as a secret in Sites settings. GEMINI_MODEL defaults to gemini-3.1-flash-lite. Never put a key in client code, a VITE_ variable, Git, or hosting.json.

The source hosting manifest declares the DB binding. Sites applies the checked-in D1 migration before deployment. The live endpoint is limited to 60 requests per UTC day across the demo and 12 requests per visitor IP bucket per 10 minutes. Old buckets expire after two days. Raw addresses and draft text are not stored by the endpoint.

## Run and build

Use Node.js 22+ and pnpm 11.25.0. Install with the Sites installation helper, then run pnpm dev. Build with the Sites build helper so Worker metadata is generated correctly. pnpm exec tsc --noEmit checks application types. pnpm run db:generate creates an additive migration when schema changes.

The app uses the Sites Vinext starter, Vite, React, TypeScript, Cloudflare Workers/D1, Zod, Drizzle and Google Gemini. The hosting starter is reused infrastructure; the brand-governance workflow is project code. AI coding assistance was used for implementation and debugging.

## Privacy and limitations

Hybrid mode sends draft text, image metadata, approved guidelines and evidence references through the server to Google Gemini. Image pixels are not sent. The API key remains a runtime secret. Local rule checks can be used without an AI request. AI findings and scores can be wrong and require human review. Model availability and demo quotas may temporarily limit live review.
