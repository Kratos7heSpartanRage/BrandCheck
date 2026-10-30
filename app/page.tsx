"use client";

import BrandCheck from "../components/brandcheck/App";

export default function Page() { return <><a href="/workspace" style={{ position: "fixed", bottom: 16, right: 16, zIndex: 100, background: "#164e43", color: "white", padding: "10px 16px", borderRadius: 10, boxShadow: "0 2px 12px #0002" }}>Shared workspaces →</a><BrandCheck /></>; }
