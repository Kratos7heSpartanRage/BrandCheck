"use client";
import { useState } from "react";
import { diffText, revisionChoices } from "../lib/revisions";

type Event = { id: string; draft_id: string | null; action: string; version: number | null; detail: string; created_at: string };
export default function RevisionCompare({ events, draftId, version, title, body, image }: { events: Event[]; draftId: string; version: number; title: string; body: string; image: { sha256?: string; alt?: string; name?: string } | null }) {
  const [chosen, setChosen] = useState("");
  const choices = revisionChoices(events, draftId, version);
  const baseline = choices.find(item => item.id === chosen) ?? choices.find(item => /approved|changes requested/.test(item.label)) ?? choices.find(item => item.version < version && (item.snapshot.title !== title || item.snapshot.body !== body || item.snapshot.image?.sha256 !== image?.sha256));
  if (!baseline) return <div className="product-revision"><h3>Revision comparison</h3><p className="product-empty">A previous saved version will appear here after the first content change or reviewer decision.</p></div>;
  const parts = diffText(baseline.snapshot.body, body);
  const changed = baseline.snapshot.title !== title || baseline.snapshot.body !== body || baseline.snapshot.image?.sha256 !== image?.sha256 || baseline.snapshot.image?.alt !== image?.alt;
  return <div className="product-revision"><h3>Revision comparison</h3><p>Compare the working draft with a saved revision or the last human decision. The comparison is for review; applying or rejecting each suggested correction remains the creator's choice.</p><label>Compare against<select value={baseline.id} onChange={e => setChosen(e.target.value)}>{choices.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    {!changed ? <p className="product-empty">No content change since this point. Reviews and assignments may have advanced the revision number.</p> : <><div className="product-diff-grid"><div><strong>Before · revision {baseline.version}</strong><p>Title: {baseline.snapshot.title}</p><pre>{parts.filter(part => part.kind !== "added").map((part,index) => <span key={index} className={part.kind === "removed" ? "product-diff-removed" : undefined}>{part.text}</span>)}</pre><small>Image: {baseline.snapshot.image?.name || "none"} · alt: {baseline.snapshot.image?.alt || "none"}</small></div><div><strong>Current {version}</strong><p>Title: {title}</p><pre>{parts.filter(part => part.kind !== "removed").map((part,index) => <span key={index} className={part.kind === "added" ? "product-diff-added" : undefined}>{part.text}</span>)}</pre><small>Image: {image?.name || "none"} · alt: {image?.alt || "none"}</small></div></div><small>Green marks added lines; rose marks removed lines. Save this draft and rerun checks before submitting a changed revision.</small></>}
  </div>;
}
