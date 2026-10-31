# CodeStar 30 — BrandCheck requirements and links

Last checked: 31 October 2026 (IST). This is a working checklist, not a replacement for the organiser's latest form or announcement.

## Links

- [Official CodeStar 30 event page](https://wecodecoders.in/events/codestar-30)
- [Inkloom AI problem statement](https://docs.google.com/document/d/1CeytklFethcPXRpwvdG4wL6AWfncC-rV/edit?usp=sharing&ouid=103477454114669134890&rtpof=true&sd=true)
- [Finalist confirmation form](https://konfhub.com/codestar30-hackathon) — the finalist email says the team leader completes this and the ₹399 team fee once. Payment is handled by the team, not this repository.
- [Live BrandCheck product](https://brandcheck.manasj1234567890.workers.dev/workspace)
- [Public source repository](https://github.com/Manas-Jain-24/brandcheck)
- [Public example without sign-in](https://brandcheck.manasj1234567890.workers.dev/example)

The Round 3 submission form link has not been supplied in the materials recorded here. Use the link posted in the official group when it is announced.

## Problem statement: product requirements

BrandCheck should help a growing organisation review content **before publication** against its approved brand material. A judge should be able to follow the central journey without a walkthrough:

1. Define or import approved guidelines, terminology, facts/evidence and reusable visual assets.
2. Add content in supported formats, including text, documents and images.
3. Check tone, terminology, messaging, factual/promotional claims, visual usage and accessibility.
4. Explain each finding, cite the relevant approved source and suggest a correction that preserves the creator's purpose.
5. Let a human review, comment, request changes or approve an exact revision. Preserve roles and decision history.
6. Show recurring issues and potential guideline gaps over time.
7. Protect confidential material, disclose external AI use and keep uncertain AI results subject to human control.

The app supports PDF, DOCX, TXT and Markdown text extraction; saved images are PNG, JPEG or WebP. Its implemented limits and data flow are documented in [README.md](README.md).

## Final round: published schedule and deliverables

The [event page](https://wecodecoders.in/events/codestar-30) lists Round 3 from **31 October 2026, 11:59 PM IST** to **3 November 2026, 11:59 PM IST**. It says the three major improvements named in Round 2 are what Round 3 is measured against. It also says only work during the permitted event window counts, judges may inspect development history, reused templates must be disclosed, and significant AI assistance is allowed when disclosed.

The finalist email supplied to the team says the final product should work end to end, include the three promised improvements, improve reliability and usability, fix important bugs, and explain changes to the original plan. It says the final submission is expected to include:

- Final working product link and public source-code repository.
- Updated project PDF.
- Completed-improvements list and technical implementation details.
- Testing notes and known limitations.
- Accurate team-member contributions.

The event page currently says **each participant files an individual entry** with their role and actual contribution, while an earlier Round 2 email instructed **leader-only submission for Round 2**. These instructions address different rounds; follow the final Round 3 form and official group announcement for the exact submission procedure. Do not invent or swap individual contributions.

The event page says no social post or video is required unless later stage-specific instructions request one. Test every submitted link in a private window before filing.

## BrandCheck implementation status

The central saved-workspace path is implemented: create workspace and policy, save content, run rule or consented AI review, inspect source-linked findings, submit, and obtain a separate human decision. The [Round 2 submission PDF](docs/BrandCheck_Round_2_Submission.pdf) promised three Round 3 improvements: grounded semantic review, real shared review, and PDF/DOCX document intake. These are the three commitments described in the [finals PDF](docs/BrandCheck_Round_3_Finals.pdf). Additional product work includes visual governance, public GitHub policy import, atomic policy regression, governance insights, saved revision comparison and reviewer-verified AI visual leads.

- [Architecture, stack, APIs, privacy and limits](README.md)
- [Latest verification record](docs/TESTING.md)
- [Hosted visual-lead screenshot](docs/qa/brandcheck-visual-leads-v11.jpg)
- [Hosted insights screenshot](docs/qa/brandcheck-insights-v11.jpg)
- [Local saved-revision screenshot](docs/qa/brandcheck-revision-diff-local.jpg)

Known verification gap: the full hosted visual-lead decision and approval cycle has not yet been observed with two different real accounts. Separate-identity permission tests passed locally. Gemini's preview OCR can invent text; it is collapsed and unverified, and its visual leads do not count as findings until a separate reviewer confirms them.

## Final submission checklist

- [ ] Complete finalist confirmation/payment if still pending.
- [ ] Confirm the final form, submitter rules and deadline from the official group.
- [ ] Run a full hosted creator → reviewer → decision test with two real accounts.
- [ ] Open the product, repository and PDF links in a private window.
- [ ] Prepare the updated PDF and accurate per-person contribution statements.
- [ ] Disclose the Sites/Vinext starter, libraries, Google Gemini, hosting and significant AI coding assistance.
- [ ] Submit all required links and files before the published deadline.
