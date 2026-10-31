import { redirect } from "next/navigation";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (await getChatGPTUser()) redirect("/workspace");

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] flex flex-col font-sans">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 sm:px-10 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5 text-[var(--text-main)] no-underline">
          <svg className="w-5 h-5 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span className="font-semibold text-lg tracking-tight font-serif">BrandCheck</span>
        </a>

        <nav className="flex items-center gap-6 text-sm text-[var(--text-muted)]">
          <a href="/example" className="hover:text-[var(--text-main)] transition-colors">Example desk</a>
          <a href="/documents" className="hover:text-[var(--text-main)] transition-colors">Document tools</a>
          <a href="/policy-lab" className="hover:text-[var(--text-main)] transition-colors">Policy lab</a>
          <a
            href="/workspace"
            className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors no-underline"
          >
            Sign in
          </a>
        </nav>
      </header>

      {/* Hero Section (Left-aligned, Quiet Editorial) */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 sm:px-10 pt-16 pb-24">
        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-[11px] font-medium tracking-wide uppercase text-[var(--text-muted)]">
            Pre-publication Brand Governance
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-normal tracking-tight text-[var(--text-main)] leading-[1.15] mb-6">
            Check content against your brand guidelines. Keep a human in the loop.
          </h1>
          <p className="text-lg text-[var(--text-muted)] leading-relaxed mb-8">
            BrandCheck links approved terminology, claim evidence and visual rules to content reviews in a shared workspace. AI findings are source-grounded and advisory; final sign-off remains with an authorized reviewer.
          </p>
          <div className="flex items-center gap-5">
            <a
              href="/workspace"
              className="inline-flex items-center justify-center h-10 px-5 text-sm font-medium rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors no-underline shadow-sm"
            >
              Open workspace
            </a>
            <a
              href="/example"
              className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] underline underline-offset-4 transition-colors"
            >
              See interactive example &rarr;
            </a>
          </div>
          <p className="text-xs text-[var(--text-subtle)] mt-3">
            Instant guest exploration available. No registration or visitor API key required.
          </p>
        </div>

        {/* Live Static Render of Real Review Screen (Framed in browser chrome) */}
        <div className="w-full border border-[var(--border-strong)] rounded-[var(--radius-lg)] bg-[var(--bg-surface)] overflow-hidden shadow-sm mb-24">
          <div className="bg-[var(--bg-surface-raised)] border-b border-[var(--border-subtle)] px-4 py-2.5 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#d4d6d2]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#d4d6d2]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#d4d6d2]" />
            <span className="text-xs font-mono text-[var(--text-subtle)] ml-2">brandcheck.internal / workspace / launch-announcement</span>
          </div>
          <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtle)]">Draft Editor · Revision 2</span>
                <span className="editorial-badge status-review">
                  <span className="status-dot" /> In review
                </span>
              </div>
              <h3 className="text-xl font-serif text-[var(--text-main)] font-normal">
                Introducing NovaDesk: The Calm Workspace for Teams
              </h3>
              <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface-sunken)] border border-[var(--border-subtle)] text-sm leading-relaxed text-[var(--text-main)]">
                Meet NovaDesk: built to simplify coordination across distributed teams. While{" "}
                <mark className="bg-[var(--highlight-term)] px-1 rounded-sm border-b border-amber-400 font-medium">
                  Flowly
                </mark>{" "}
                was known for personal notes, NovaDesk introduces shared workflows. We{" "}
                <mark className="bg-[var(--highlight-tone)] px-1 rounded-sm border-b border-purple-400 font-medium">
                  guarantee
                </mark>{" "}
                it delivers{" "}
                <mark className="bg-[var(--highlight-claim)] px-1 rounded-sm border-b border-orange-400 font-medium">
                  2x productivity for every team
                </mark>{" "}
                from day one.
              </div>
              <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                <span>Policy pack: NovaDesk Core v2</span>
                <span>Assigned to: reviewer@brandcheck.internal</span>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-3">
              <div className="pb-2 border-b border-[var(--border-subtle)]">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtle)]">
                  Source-Grounded Findings (3)
                </span>
              </div>

              {/* Finding Card 1 */}
              <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--status-warn-border)] bg-[var(--status-warn-bg)] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--status-warn-text)]">Terminology · Retired Name</span>
                  <span className="font-mono text-[10px] text-[var(--text-subtle)]">TERM-001 v2</span>
                </div>
                <p className="text-[var(--status-warn-text)] leading-normal">
                  &ldquo;Flowly&rdquo; is a retired product name. The approved name is &ldquo;NovaDesk&rdquo;.
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-[var(--text-muted)]">Replace with: NovaDesk</span>
                  <span className="text-[var(--accent-primary)] font-medium">Rule match</span>
                </div>
              </div>

              {/* Finding Card 2 */}
              <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--status-review-border)] bg-[var(--status-review-bg)] text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--status-review-text)]">Promotional Claim · Evidence Needed</span>
                  <span className="font-mono text-[10px] text-[var(--text-subtle)]">CLAIM-001 v1</span>
                </div>
                <p className="text-[var(--status-review-text)] leading-normal">
                  Quantitative performance claims (&ldquo;2x productivity&rdquo;) require dated evidentiary support in the brand pack.
                </p>
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-muted)]">Source: Performance Substantiation Guide</span>
                  <span className="text-[var(--text-subtle)]">Needs review</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: How a Review Works */}
        <section className="mb-24">
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[var(--text-main)] mb-3">
              How a review works
            </h2>
            <p className="text-sm text-[var(--text-muted)] max-w-xl">
              Brand governance without ambiguity. Every decision is bound to a specific revision and approved guideline version.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="font-mono text-xs text-[var(--text-subtle)] mb-2 block">01 / DEFINE</span>
              <h4 className="text-base font-serif font-medium text-[var(--text-main)] mb-2">Approved guidelines</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Maintain single sources of truth for positioning, naming, claim evidence, colors, and asset hashes.
              </p>
            </div>

            <div className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="font-mono text-xs text-[var(--text-subtle)] mb-2 block">02 / WRITE & IMPORT</span>
              <h4 className="text-base font-serif font-medium text-[var(--text-main)] mb-2">Multimodal content</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Compose in-app or import PDF/DOCX files with client-side text extraction mapped directly to pages and paragraphs.
              </p>
            </div>

            <div className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="font-mono text-xs text-[var(--text-subtle)] mb-2 block">03 / SOURCE-GROUNDED REVIEW</span>
              <h4 className="text-base font-serif font-medium text-[var(--text-main)] mb-2">Strict verification</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Run deterministic rules and consented Gemini checks. Every finding must quote input text and cite an approved source.
              </p>
            </div>

            <div className="p-5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
              <span className="font-mono text-xs text-[var(--text-subtle)] mb-2 block">04 / HUMAN SIGN-OFF</span>
              <h4 className="text-base font-serif font-medium text-[var(--text-main)] mb-2">Accountable decisions</h4>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Separate reviewers approve or request changes. Self-review is strictly denied by the server.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Every Finding Cites Its Source */}
        <section className="mb-24 p-8 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="max-w-xl mb-8">
            <h2 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[var(--text-main)] mb-3">
              Every finding cites its source
            </h2>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed">
              We eliminate vague model opinions. When BrandCheck identifies an issue, it links directly to the specific policy entry, source version, and evidence record.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div className="p-5 rounded-[var(--radius-md)] bg-[var(--bg-surface-sunken)] border border-[var(--border-subtle)] space-y-3">
              <span className="text-xs font-mono uppercase text-[var(--text-subtle)]">Extracted Content Snippet</span>
              <p className="text-sm font-serif italic text-[var(--text-main)] leading-relaxed">
                &ldquo;Flowly provides instant 2x output for engineering teams.&rdquo;
              </p>
              <div className="pt-2 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span>Location: Page 2, Paragraph 4</span>
                <span className="font-mono">sample-deck.pdf</span>
              </div>
            </div>

            <div className="p-5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-strong)] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-[var(--accent-primary)] font-semibold">Cites: TERM-001 (Terminology Policy)</span>
                <span className="editorial-badge">Policy v2</span>
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                &ldquo;NovaDesk is the official product name. Former pre-launch and acquired names (including Flowly) must not appear in external collateral.&rdquo;
              </p>
              <div className="pt-2 text-xs flex items-center justify-between text-[var(--text-subtle)] border-t border-[var(--border-subtle)]">
                <span>Action: Replace with approved term</span>
                <span className="text-[var(--accent-primary)] font-medium">1-click correction available</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Honest Boundaries — What AI Does and Doesn't Do */}
        <section className="mb-24">
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-serif font-normal tracking-tight text-[var(--text-main)] mb-3">
              Honest boundaries: What AI does and does not do
            </h2>
            <p className="text-sm text-[var(--text-muted)] max-w-xl">
              We design for institutional trust. BrandCheck does not promise automated legal compliance or flawless AI verdicts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
              <h4 className="text-base font-serif font-medium text-[var(--text-main)] flex items-center gap-2">
                <span className="text-[var(--status-approved-text)]">✓</span> What BrandCheck delivers
              </h4>
              <ul className="text-xs text-[var(--text-muted)] space-y-2.5 leading-relaxed pl-1">
                <li>• <strong>Exact source-linking:</strong> AI suggestions must quote text in the draft and map to an active source.</li>
                <li>• <strong>Unverified visual leads:</strong> Multimodal visual observations are quarantined until a human reviewer confirms them.</li>
                <li>• <strong>Graceful rule fallback:</strong> When AI quotas or timeouts occur, deterministic rules run with full provenance transparency.</li>
                <li>• <strong>Optimistic concurrency:</strong> Compare-and-swap revision tracking prevents concurrent editing corruption.</li>
              </ul>
            </div>

            <div className="p-6 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-4">
              <h4 className="text-base font-serif font-medium text-[var(--text-main)] flex items-center gap-2">
                <span className="text-[var(--status-danger-text)]">✕</span> What BrandCheck does NOT claim
              </h4>
              <ul className="text-xs text-[var(--text-muted)] space-y-2.5 leading-relaxed pl-1">
                <li>• <strong>No automated publication:</strong> AI never approves content. Approval requires an authorized human decision.</li>
                <li>• <strong>No independent truth engine:</strong> Claims are checked only against internal approved evidence records.</li>
                <li>• <strong>No OCR for scanned documents:</strong> PDFs and DOCX files must contain an extractable text layer.</li>
                <li>• <strong>No tamper-proof blockchain:</strong> Audit trails are application-append-only in Cloudflare D1 with trusted admins.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 4: Quiet Footer CTA */}
        <div className="text-center py-12 px-6 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <h3 className="text-2xl font-serif text-[var(--text-main)] mb-3">
            Start governing your brand today
          </h3>
          <p className="text-sm text-[var(--text-muted)] max-w-md mx-auto mb-6">
            Collaborate on brand guidelines, review content with evidence, and keep decisions traceable.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a
              href="/workspace"
              className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors no-underline"
            >
              Open workspace
            </a>
            <a
              href="/example"
              className="inline-flex items-center justify-center h-9 px-4 text-xs font-medium rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-white text-[var(--text-main)] hover:bg-[var(--bg-surface-raised)] transition-colors no-underline"
            >
              Explore sample without sign-in
            </a>
          </div>
        </div>
      </main>

      {/* Footer with CodeStar 30 Links */}
      <footer className="border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-8 px-6 sm:px-10 text-xs text-[var(--text-subtle)]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <span>BrandCheck &copy; 2026 · Built for CodeStar 30 Finals (Team mayankkumar.prof)</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="https://github.com/Manas-Jain-24/brandcheck/tree/judge-hosted" target="_blank" rel="noreferrer" className="hover:text-[var(--text-main)] underline">
              Source Repository
            </a>
            <a href="/documents" className="hover:text-[var(--text-main)] underline">
              Document Tools
            </a>
            <a href="/policy-lab" className="hover:text-[var(--text-main)] underline">
              Policy Lab
            </a>
            <a href="/example" className="hover:text-[var(--text-main)] underline">
              Interactive Example
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
