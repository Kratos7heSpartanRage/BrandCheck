"use client";
import BrandCheck from "../../components/brandcheck/App";
export default function ExamplePage() { return <><nav style={{background:"#103f33",color:"white",padding:"12px 24px",display:"flex",gap:24,font:"14px system-ui"}}><strong>BrandCheck · example</strong><a style={{color:"white"}} href="/workspace">Open your workspace</a><a style={{color:"white"}} href="/documents">Document review</a></nav><BrandCheck autoStart /></>; }
