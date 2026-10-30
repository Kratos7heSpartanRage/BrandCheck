"use client";

import BrandCheck from "../components/brandcheck/App";

export default function Page() { return <><nav aria-label="BrandCheck tools" style={{ display: "flex", flexWrap: "wrap", gap: "12px 24px", background: "#164e43", color: "white", padding: "12px 24px", font: "14px system-ui" }}><strong>BrandCheck</strong><a href="/documents" style={{ color: "white" }}>PDF / DOCX review</a><a href="/policy-lab" style={{ color: "white" }}>Policy regression sandbox</a><a href="/workspace" style={{ color: "white" }}>Shared workspaces →</a></nav><BrandCheck /></>; }
