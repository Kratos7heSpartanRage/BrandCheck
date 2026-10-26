import type { DraftBody } from "../model";

/**
 * 5 Labeled realistic drafts committed to in Round 1 Submission:
 * Used for benchmark testing, precision, recall, and false-positive checks.
 */

// Draft 1: Typical high-risk promotional social post
export const benchmarkSocialLaunchDraft: DraftBody = {
  title: "Q4 Product Launch - Social Blast",
  channel: "Twitter / X",
  audience: "Tech Enthusiasts & Prospects",
  text: "Flowly guarantees 2x productivity for every team! Meet the future of work.",
  image: {
    name: "launch-graphic.png",
    mime: "image/png",
    bytes: 120_000,
    sha256: "approved-demo-asset",
    alt: "",
    decorative: false,
    source: "approved-demo",
  },
};

// Draft 2: Clean, fully compliant product release announcement
export const benchmarkCleanAnnouncementDraft: DraftBody = {
  title: "NovaDesk 1.0 General Availability",
  channel: "Company Blog",
  audience: "Existing Customers and Partners",
  text: "Meet NovaDesk, designed to simplify daily work for your entire organisation.",
  image: {
    name: "novadesk-launch.svg",
    mime: "image/svg+xml",
    bytes: 45_000,
    sha256: "approved-demo-asset",
    alt: "Illustration of the NovaDesk collaboration workspace interface.",
    decorative: false,
    source: "approved-demo",
  },
};

// Draft 3: Subtle overpromising & hyperbole in an email newsletter
export const benchmarkOverpromisingNewsletterDraft: DraftBody = {
  title: "Weekly Product Update",
  channel: "Email Newsletter",
  audience: "Subscribers",
  text: "Experience our revolutionary, flawless collaboration tool that cuts your workday in half.",
  image: null,
};

// Draft 4: Press release citing expired claim evidence
export const benchmarkExpiredEvidenceDraft: DraftBody = {
  title: "Enterprise Benchmark Findings",
  channel: "Press Release",
  audience: "Media and Enterprise Buyers",
  text: "NovaDesk delivers 3x faster response times across distributed engineering hubs.",
  image: null,
};

// Draft 5: Unapproved visual asset in marketing graphic
export const benchmarkUnapprovedAssetDraft: DraftBody = {
  title: "Partner Showcase Ad",
  channel: "LinkedIn Sponsored Ad",
  audience: "Business Leaders",
  text: "NovaDesk is designed to simplify daily work for modern teams.",
  image: {
    name: "external-marketing-banner.png",
    mime: "image/png",
    bytes: 210_000,
    sha256: "unverified-sha256-hash-999abc",
    alt: "Modern business leaders collaborating around a conference table.",
    decorative: false,
    source: "upload",
  },
};

export const allBenchmarkDrafts = [
  {
    name: "Social Launch Ad",
    draft: benchmarkSocialLaunchDraft,
    expectedIssueCount: 3,
  },
  {
    name: "Clean Announcement",
    draft: benchmarkCleanAnnouncementDraft,
    expectedIssueCount: 0,
  },
  {
    name: "Overpromising Newsletter",
    draft: benchmarkOverpromisingNewsletterDraft,
    expectedIssueCount: 2,
  },
  {
    name: "Expired Evidence Press Release",
    draft: benchmarkExpiredEvidenceDraft,
    expectedIssueCount: 1,
  },
  {
    name: "Unapproved Asset Ad",
    draft: benchmarkUnapprovedAssetDraft,
    expectedIssueCount: 1,
  },
];
