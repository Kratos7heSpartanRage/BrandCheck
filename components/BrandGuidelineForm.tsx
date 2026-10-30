"use client";
import { useState } from "react";
import type { Policy } from "../lib/policy";
import type { ImageMeta } from "../lib/content";
import { inspectImage } from "../lib/image-client";
export default function BrandGuidelineForm({ pack, busy, propose }: { pack: Policy; busy: boolean; propose: (pack: Policy) => void }) {
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState(pack.sources.find(s => s.id === "MSG-001")?.body || "");
  const [tone, setTone] = useState(pack.sources.find(s => s.id === "TONE-001")?.body || "Write clearly and specifically.");
  const [terms, setTerms] = useState(pack.terms.map(t => `${t.retired} => ${t.preferred}`).join("\n"));
  const [claim, setClaim] = useState(""); const [reference, setReference] = useState(""); const [expires, setExpires] = useState("");
  const [asset, setAsset] = useState<ImageMeta | null>(null);
  const [palette, setPalette] = useState((pack.palette ?? []).join(", "));
  const [error, setError] = useState("");
  return <form onSubmit={event => {
    event.preventDefault(); setError("");
    const lines = terms.split("\n").filter(line => line.trim());
    if (lines.some(line => line.split("=>").length !== 2 || line.split("=>").some(part => !part.trim() || part.trim().length > 80))) { setError("Use one pair per line, such as OldName => NewName. Each name can contain up to 80 characters."); return; }
    const next = structuredClone(pack); next.name = name;
    function source(id: string, title: string, body: string, kind: Policy["sources"][number]["kind"]) {
      const prior = next.sources.find(s => s.id === id);
      const value = { id, title, body, kind, status: "Approved" as const, updated: new Date().toISOString().slice(0,10), version: `update-${Date.now()}` };
      next.sources = [...next.sources.filter(s => s.id !== id), prior?.body === body && prior.status === "Approved" ? prior : value];
    }
    source("TERM-001", "Approved terminology", "Use the preferred names in this workspace's approved terminology list.", "Terminology");
    if (description.trim()) source("MSG-001", "Approved positioning", description, "Messaging");
    source("TONE-001", "Voice and tone", tone, "Messaging");
    next.terms = lines.map((line, index) => { const [retired, preferred] = line.split("=>").map(s => s.trim()); return { id: `term-${index + 1}`, retired, preferred, sourceId: "TERM-001" }; });
    if (claim.trim()) {
      if (!reference.trim() || !expires) { setError("A claim needs a source reference and an expiry date."); return; }
      const id = `evidence-${Date.now()}`;
      source(id, "Approved claim evidence", reference, "Evidence");
      next.evidence.push({ id, claim, reference, expiresAt: expires, sourceId: id });
    }
    const colors = palette.split(/[\s,]+/).filter(Boolean);
    if (colors.some(color => !/^#[0-9a-fA-F]{6}$/.test(color)) || colors.length > 12) { setError("Use up to 12 colours as six-digit hex values, such as #174e39."); return; }
    next.palette = colors;
    if (asset) {
      source("ASSET-001", "Approved visual assets", "Use approved brand images. Unknown file fingerprints need reviewer confirmation; dominant colour is only a heuristic for brand graphics.", "Asset policy");
      next.approvedAssets = [...(next.approvedAssets ?? []).filter(item => item.sha256 !== asset.sha256), { name: asset.name, sha256: asset.sha256, sourceId: "ASSET-001", approvedAt: new Date().toISOString().slice(0,10) }];
    }
    if (colors.length) source("ASSET-001", "Approved visual assets", "Use approved brand images and the approved graphic palette. A colour sample is only a heuristic and needs human assessment.", "Asset policy");
    source("ACCESS-001", "Image descriptions", "Meaningful images need useful alternative text. Mark purely decorative images as decorative.", "Accessibility");
    propose(next);
  }}>
    <h3>Edit brand guidelines</h3><p>Define what your reviewers should check. Your changes become a proposal for approval.</p>
    <label>Guideline name<input required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Approved product description<textarea maxLength={2000} rows={3} placeholder="What can creators safely say about this brand?" value={description} onChange={e => setDescription(e.target.value)} /></label>
    <label>Voice and tone<textarea required maxLength={2000} rows={3} value={tone} onChange={e => setTone(e.target.value)} /></label>
    <label>Retired names and preferred replacements<textarea rows={3} placeholder={'OldName => NewName\nOld slogan => Approved slogan'} value={terms} onChange={e => setTerms(e.target.value)} /></label>
    <details><summary>Add an approved claim and evidence</summary><label>Exact approved claim<input maxLength={200} value={claim} onChange={e => setClaim(e.target.value)} /></label><label>Evidence URL or source reference<input maxLength={500} value={reference} onChange={e => setReference(e.target.value)} /></label><label>Evidence valid through<input type="date" value={expires} onChange={e => setExpires(e.target.value)} /></label><small>Evidence is supplied by your team. The app does not independently establish that it is true.</small></details>
    <details><summary>Approved images and graphic colours</summary><p>Adding an asset or palette creates a policy proposal; an admin still has to activate it.</p><label>Approved asset file<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async e => { const file=e.target.files?.[0]; if (!file) return; try { setAsset(await inspectImage(file)); setError(""); } catch (problem) { setError((problem as Error).message); } }} /></label>{asset && <small>{asset.name} · SHA-256 {asset.sha256.slice(0,16)}…</small>}{(pack.approvedAssets ?? []).map(item => <small key={item.sha256}>Approved: {item.name} · {item.sha256.slice(0,16)}…</small>)}<label>Brand graphic colours (hex, comma separated)<input placeholder="#174e39, #f5f7f4" value={palette} onChange={e => setPalette(e.target.value)} /></label><small>Palette checks sample dominant colour only for images marked Brand graphic; photographs are excluded.</small></details>
    {error && <p role="alert">{error}</p>}<button disabled={busy}>Propose guideline changes</button>
  </form>;
}
