export type Persona = "creator" | "reviewer";
export type Screen = "workspace" | "sources" | "activity";
export type Status = "draft" | "awaiting" | "changes_requested" | "approved";
export type EvidenceStatus =
  "Rule match" | "Review suggestion" | "Evidence needed";
export type Category =
  | "Terminology"
  | "Claims"
  | "Tone"
  | "Accessibility"
  | "Asset usage"
  | "Messaging";

export type DetectionMethod = "deterministic" | "ai";
export type ReviewMode = "hybrid" | "rules";

export const GEMINI_MODELS = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite · Tested live" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash · Fast review" },
  { id: "gemini-flash-latest", label: "Gemini Flash · Latest alias" },
  { id: "gemini-pro-latest", label: "Gemini Pro · Latest alias" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash · Preview" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro · Preview" },
] as const;
export const DEFAULT_GEMINI_MODEL = GEMINI_MODELS[0].id;

export interface Source {
  id: string;
  title: string;
  body: string;
  version: string;
  updated: string;
  kind:
    | "Terminology"
    | "Messaging"
    | "Claim policy"
    | "Accessibility"
    | "Asset policy"
    | "Evidence";
  status: "Approved" | "Retired";
}

export interface TermRule {
  id: string;
  retired: string;
  preferred: string;
  sourceId: string;
}

export interface EvidenceRecord {
  id: string;
  claim: string;
  reference: string;
  expiresAt: string;
  sourceId: string;
}

export interface ApprovedAsset {
  sha256: string;
  name: string;
  approvedAt: string;
  sourceId: string;
}

export interface ImageRef {
  name: string;
  mime: string;
  bytes: number;
  sha256: string;
  dataUrl?: string;
  alt: string;
  decorative: boolean;
  source: "approved-demo" | "upload";
}

export interface DraftBody {
  title: string;
  channel: string;
  audience: string;
  text: string;
  image: ImageRef | null;
}

export interface Finding {
  id: string;
  category: Category;
  severity: "Needs attention" | "Suggestion";
  evidenceStatus: EvidenceStatus;
  location: string;
  excerpt: string;
  explanation: string;
  sourceId: string;
  sourceVersion: string;
  suggestion: string;
  replacement?: { from: string; to: string };
  detectedBy?: DetectionMethod;
}

export interface Dismissal {
  findingId: string;
  reason: string;
}

export interface Version {
  id: number;
  at: string;
  by: Persona;
  body: DraftBody;
  findings: Finding[];
  dismissals: Dismissal[];
  note: string;
}

export interface Comment {
  id: string;
  at: string;
  by: Persona;
  text: string;
  versionId: number;
}

export interface Decision {
  id: string;
  at: string;
  by: "reviewer";
  action: "approved" | "changes_requested";
  reason: string;
  versionId: number;
  acceptedFindingIds?: string[];
}

export interface ReviewEvent {
  at: string;
  category: Category;
  sourceId: string;
}

export interface DraftRecord {
  assessment: DraftAssessment | null;
  reviewNotice: string | null;
  draftId: string;
  status: Status;
  body: DraftBody;
  findings: Finding[];
  reviewedFingerprint: string | null;
  dismissals: Dismissal[];
  versions: Version[];
  comments: Comment[];
  decisions: Decision[];
}

export interface BrandPackExport {
  name: string;
  version: string;
  exportedAt: string;
  sources: Source[];
  terms: TermRule[];
  evidence: EvidenceRecord[];
  approvedAssets: ApprovedAsset[];
}

export interface DraftAssessment {
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  score: number; // 0 to 100
  summary: string;
  claimRiskNote: string;
  toneRiskNote: string;
  suggestedRewrite: string;
}

export interface AppState extends DraftRecord {
  started: boolean;
  persona: Persona;
  screen: Screen;
  savedDrafts: DraftRecord[];
  sources: Source[];
  terms: TermRule[];
  evidence: EvidenceRecord[];
  approvedAssets: ApprovedAsset[];
  reviewEvents: ReviewEvent[];
  reviewRuns: number;
  // AI & Mode configuration
  reviewMode: ReviewMode;
  geminiApiKey: string;
  geminiModel: string;
  isReviewing: boolean;
}

export const dateLabel = (iso: string) =>
  `${new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  })} IST`;

export const FINGERPRINT = (body: DraftBody) => JSON.stringify(body);

export const seedSources: Source[] = [
  {
    id: "TERM-001",
    title: "Product naming",
    body: "NovaDesk is the approved product name. Flowly is retired and must not appear in new material.",
    version: "1.0",
    updated: "2026-10-26",
    kind: "Terminology",
    status: "Approved",
  },
  {
    id: "MSG-001",
    title: "Approved product description",
    body: "NovaDesk is designed to simplify daily work. This is approved positioning, not a quantified performance promise.",
    version: "1.0",
    updated: "2026-10-26",
    kind: "Messaging",
    status: "Approved",
  },
  {
    id: "CLAIM-001",
    title: "Evidence for promotional claims",
    body: "Quantified performance or outcome claims require a linked, current approved evidence record. No evidence for a 2x productivity claim is in this demo pack.",
    version: "1.0",
    updated: "2026-10-26",
    kind: "Claim policy",
    status: "Approved",
  },
  {
    id: "TONE-001",
    title: "Voice and tone",
    body: "Write with a clear, calm and specific voice. Avoid absolute promises such as “guarantees” unless an authorised reviewer can substantiate them.",
    version: "1.0",
    updated: "2026-10-26",
    kind: "Messaging",
    status: "Approved",
  },
  {
    id: "ACCESS-001",
    title: "Image descriptions",
    body: "Meaningful images need useful alternative text. Mark a purely decorative image as decorative rather than leaving its purpose ambiguous.",
    version: "1.0",
    updated: "2026-10-26",
    kind: "Accessibility",
    status: "Approved",
  },
  {
    id: "ASSET-001",
    title: "Approved visual assets",
    body: "Use approved brand assets. An uploaded file whose SHA-256 fingerprint is not in the approved library needs reviewer confirmation before publication.",
    version: "1.0",
    updated: "2026-10-26",
    kind: "Asset policy",
    status: "Approved",
  },
];

export const seedTerms: TermRule[] = [
  {
    id: "term-flowly",
    retired: "Flowly",
    preferred: "NovaDesk",
    sourceId: "TERM-001",
  },
];

export const demoBody: DraftBody = {
  title: "Product launch social post",
  channel: "LinkedIn",
  audience: "Prospective customers",
  text: "Flowly guarantees 2x productivity for every team. Meet the future of work.",
  image: {
    name: "novadesk-launch.svg",
    mime: "image/svg+xml",
    bytes: 0,
    sha256: "approved-demo-asset",
    alt: "",
    decorative: false,
    source: "approved-demo",
  },
};

export const makeInitialState = (): AppState => ({
  draftId: "draft-launch",
  savedDrafts: [],
  started: false,
  persona: "creator",
  screen: "workspace",
  status: "draft",
  body: structuredClone(demoBody),
  sources: structuredClone(seedSources),
  terms: structuredClone(seedTerms),
  evidence: [],
  approvedAssets: [],
  findings: [],
  reviewedFingerprint: null,
  dismissals: [],
  versions: [],
  comments: [],
  decisions: [],
  reviewEvents: [],
  reviewRuns: 0,
  reviewMode: "hybrid",
  geminiApiKey: "",
  geminiModel: DEFAULT_GEMINI_MODEL,
  isReviewing: false,
  reviewNotice: null,
  assessment: null,
});
