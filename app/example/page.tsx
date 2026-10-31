"use client";
import BrandCheck from "../../components/brandcheck/App";

export default function ExamplePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] font-sans">
      <header className="bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] px-6 sm:px-10 h-14 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <a href="/" className="font-serif font-semibold text-[var(--text-main)] no-underline flex items-center gap-2">
            <svg className="w-4 h-4 text-[var(--accent-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            BrandCheck
          </a>
          <span className="text-[var(--text-subtle)]">/</span>
          <span className="text-[var(--text-muted)] font-medium">Guest interactive desk</span>
        </div>
        <div className="flex items-center gap-4 text-[var(--text-muted)]">
          <a href="/workspace" className="hover:text-[var(--text-main)] underline font-medium">
            Open authenticated workspace
          </a>
          <a href="/documents" className="hover:text-[var(--text-main)] underline">
            Document tools
          </a>
        </div>
      </header>
      <BrandCheck autoStart />
    </div>
  );
}
