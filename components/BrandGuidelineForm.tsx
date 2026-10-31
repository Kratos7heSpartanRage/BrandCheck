"use client";
import { useState } from "react";
import type { Policy } from "../lib/policy";
import type { ImageMeta } from "../lib/content";
import { inspectImage } from "../lib/image-client";

export default function BrandGuidelineForm({
  pack,
  busy,
  propose,
}: {
  pack: Policy;
  busy: boolean;
  propose: (pack: Policy) => void;
}) {
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(
    pack.sources.find((s) => s.id === "MSG-001")?.body || "",
  );
  const [tone, setTone] = useState(
    pack.sources.find((s) => s.id === "TONE-001")?.body ||
      "Write clearly and specifically.",
  );
  const [terms, setTerms] = useState(
    pack.terms.map((t) => `${t.retired} => ${t.preferred}`).join("\n"),
  );
  const [claim, setClaim] = useState("");
  const [reference, setReference] = useState("");
  const [expires, setExpires] = useState("");
  const [asset, setAsset] = useState<ImageMeta | null>(null);
  const [palette, setPalette] = useState((pack.palette ?? []).join(", "));
  const [error, setError] = useState("");

  const paletteColors = palette
    .split(/[\s,]+/)
    .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError("");
        const lines = terms.split("\n").filter((line) => line.trim());
        if (
          lines.some(
            (line) =>
              line.split("=>").length !== 2 ||
              line.split("=>").some((part) => !part.trim() || part.trim().length > 80),
          )
        ) {
          setError(
            "Use one pair per line, such as OldName => NewName. Each name can contain up to 80 characters.",
          );
          return;
        }
        const next = structuredClone(pack);
        next.name = name;
        function source(
          id: string,
          title: string,
          body: string,
          kind: Policy["sources"][number]["kind"],
        ) {
          const prior = next.sources.find((s) => s.id === id);
          const value = {
            id,
            title,
            body,
            kind,
            status: "Approved" as const,
            updated: new Date().toISOString().slice(0, 10),
            version: `update-${Date.now()}`,
          };
          next.sources = [
            ...next.sources.filter((s) => s.id !== id),
            prior?.body === body && prior.status === "Approved" ? prior : value,
          ];
        }
        source(
          "TERM-001",
          "Approved terminology",
          "Use the preferred names in this workspace's approved terminology list.",
          "Terminology",
        );
        if (description.trim())
          source("MSG-001", "Approved positioning", description, "Messaging");
        source("TONE-001", "Voice and tone", tone, "Messaging");
        next.terms = lines.map((line, index) => {
          const [retired, preferred] = line.split("=>").map((s) => s.trim());
          return {
            id: `term-${index + 1}`,
            retired,
            preferred,
            sourceId: "TERM-001",
          };
        });
        if (claim.trim()) {
          if (!reference.trim() || !expires) {
            setError("A claim needs a source reference and an expiry date.");
            return;
          }
          const id = `evidence-${Date.now()}`;
          source(id, "Approved claim evidence", reference, "Evidence");
          next.evidence.push({
            id,
            claim,
            reference,
            expiresAt: expires,
            sourceId: id,
          });
        }
        const colors = palette.split(/[\s,]+/).filter(Boolean);
        if (
          colors.some((color) => !/^#[0-9a-fA-F]{6}$/.test(color)) ||
          colors.length > 12
        ) {
          setError(
            "Use up to 12 colours as six-digit hex values, such as #174e39.",
          );
          return;
        }
        next.palette = colors;
        if (asset) {
          source(
            "ASSET-001",
            "Approved visual assets",
            "Use approved brand images. Unknown file fingerprints need reviewer confirmation; dominant colour is only a heuristic for brand graphics.",
            "Asset policy",
          );
          next.approvedAssets = [
            ...(next.approvedAssets ?? []).filter(
              (item) => item.sha256 !== asset.sha256,
            ),
            {
              name: asset.name,
              sha256: asset.sha256,
              sourceId: "ASSET-001",
              approvedAt: new Date().toISOString().slice(0, 10),
            },
          ];
        }
        if (colors.length)
          source(
            "ASSET-001",
            "Approved visual assets",
            "Use approved brand images and the approved graphic palette. A colour sample is only a heuristic and needs human assessment.",
            "Asset policy",
          );
        source(
          "ACCESS-001",
          "Image descriptions",
          "Meaningful images need useful alternative text. Mark purely decorative images as decorative.",
          "Accessibility",
        );
        propose(next);
      }}
    >
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-[var(--text-main)]">
          Interactive Guideline Editor
        </h4>
        <p className="text-xs text-[var(--text-muted)]">
          Configure authoritative terminology, messaging, and claim policies. Saving creates a reviewable proposal.
        </p>
      </div>

      <div className="space-y-3 pt-2">
        <label className="text-xs text-[var(--text-muted)] block space-y-1">
          <span className="font-medium text-[var(--text-main)]">Guideline Name</span>
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
          />
        </label>

        <label className="text-xs text-[var(--text-muted)] block space-y-1">
          <span className="font-medium text-[var(--text-main)]">Approved Product Description (MSG-001)</span>
          <textarea
            maxLength={2000}
            rows={2}
            placeholder="What can creators safely say about this brand?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
          />
        </label>

        <label className="text-xs text-[var(--text-muted)] block space-y-1">
          <span className="font-medium text-[var(--text-main)]">Voice and Tone Criteria (TONE-001)</span>
          <textarea
            required
            maxLength={2000}
            rows={2}
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
          />
        </label>

        <label className="text-xs text-[var(--text-muted)] block space-y-1">
          <span className="font-medium text-[var(--text-main)]">Retired Names & Preferred Terms (TERM-001)</span>
          <span className="text-[11px] text-[var(--text-subtle)] block">
            One pair per line: <code className="font-mono text-[10px] bg-[var(--bg-surface-sunken)] px-1 py-0.5 rounded">RetiredTerm =&gt; PreferredTerm</code>
          </span>
          <textarea
            rows={3}
            placeholder={"OldName => NewName\nFlowly => NovaDesk"}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full p-2 font-mono text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
          />
        </label>
      </div>

      {/* Expandable Sections for Evidence & Assets */}
      <div className="space-y-2 pt-2">
        <details className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-xs group">
          <summary className="cursor-pointer font-medium text-[var(--text-main)] flex items-center justify-between">
            <span>+ Add Approved Performance Claim & Evidence (CLAIM-001)</span>
            <span className="text-[10px] text-[var(--text-subtle)] group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <label className="text-xs text-[var(--text-muted)] block space-y-1">
              <span className="font-medium">Exact Claim Phrase</span>
              <input
                maxLength={200}
                placeholder="e.g. 2x productivity"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="w-full p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)] block space-y-1">
              <span className="font-medium">Evidence URL or Study Reference</span>
              <input
                maxLength={500}
                placeholder="Internal Study 2026, Case Study Q3"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full p-2 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
              />
            </label>
            <label className="text-xs text-[var(--text-muted)] block space-y-1">
              <span className="font-medium">Evidence Expiration Date</span>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="p-1.5 text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
              />
            </label>
            <small className="text-[11px] text-[var(--text-subtle)] block">
              Evidence records are linked to CLAIM-001; claims without unexpired evidence trigger an "Evidence needed" finding.
            </small>
          </div>
        </details>

        <details className="p-3.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface-raised)] text-xs group">
          <summary className="cursor-pointer font-medium text-[var(--text-main)] flex items-center justify-between">
            <span>+ Approved Visual Assets & Color Palette (ASSET-001)</span>
            <span className="text-[10px] text-[var(--text-subtle)] group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="space-y-3 mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <label className="text-xs text-[var(--text-muted)] block space-y-1">
              <span className="font-medium">Add Approved Graphic File (Computes SHA-256)</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setAsset(await inspectImage(file));
                    setError("");
                  } catch (problem) {
                    setError((problem as Error).message);
                  }
                }}
                className="w-full text-xs p-1.5 border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)]"
              />
            </label>

            {asset && (
              <div className="p-2 rounded bg-[var(--bg-surface-sunken)] font-mono text-[11px] text-[var(--text-muted)]">
                Selected: <strong>{asset.name}</strong> · SHA-256 {asset.sha256.slice(0, 16)}…
              </div>
            )}

            {(pack.approvedAssets ?? []).length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--text-subtle)]">Currently Approved Assets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {(pack.approvedAssets ?? []).map((item) => (
                    <span
                      key={item.sha256}
                      className="px-2 py-0.5 rounded bg-[var(--bg-surface-sunken)] border border-[var(--border-subtle)] font-mono text-[10px] text-[var(--text-muted)]"
                    >
                      {item.name} ({item.sha256.slice(0, 8)}…)
                    </span>
                  ))}
                </div>
              </div>
            )}

            <label className="text-xs text-[var(--text-muted)] block space-y-1">
              <span className="font-medium">Brand Palette (Up to 12 hex colors)</span>
              <input
                placeholder="#1a4332, #fbfbfa, #88bea4"
                value={palette}
                onChange={(e) => setPalette(e.target.value)}
                className="w-full p-2 font-mono text-xs border border-[var(--border-strong)] rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-main)]"
              />
            </label>

            {paletteColors.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-[var(--text-subtle)]">Swatches:</span>
                <div className="flex gap-1.5">
                  {paletteColors.map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full border border-black/10 shadow-sm"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      {error && (
        <p role="alert" className="text-xs text-[#b91c1c] font-medium">
          {error}
        </p>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={busy}
          className="h-8 px-4 text-xs font-medium rounded-[var(--radius-sm)] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors shadow-sm disabled:opacity-50"
        >
          Propose Guideline Changes
        </button>
      </div>
    </form>
  );
}
