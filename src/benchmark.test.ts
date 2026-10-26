import { describe, expect, it } from "vitest";
import {
  benchmarkCleanAnnouncementDraft,
  benchmarkExpiredEvidenceDraft,
  benchmarkOverpromisingNewsletterDraft,
  benchmarkSocialLaunchDraft,
  benchmarkUnapprovedAssetDraft,
} from "./benchmarks/drafts";
import { seedSources, seedTerms } from "./model";
import type { Source } from "./model";
import { reviewDraft, reviewDraftHybrid } from "./review";

describe("5-Draft Benchmark Suite (Round 1 Commitments)", () => {
  it("resolves 100% of findings to current, valid approved source IDs", async () => {
    const drafts = [
      benchmarkSocialLaunchDraft,
      benchmarkCleanAnnouncementDraft,
      benchmarkOverpromisingNewsletterDraft,
      benchmarkExpiredEvidenceDraft,
      benchmarkUnapprovedAssetDraft,
    ];

    const activeSourceIds = new Set(
      seedSources
        .filter((source) => source.status === "Approved")
        .map((source) => source.id),
    );

    for (const draft of drafts) {
      const result = await reviewDraftHybrid(
        draft,
        seedSources,
        seedTerms,
        [],
        {
          mode: "hybrid",
        },
      );

      for (const finding of result.findings) {
        expect(
          activeSourceIds.has(finding.sourceId),
          `Finding ${finding.id} references invalid or missing Source ID: ${finding.sourceId}`,
        ).toBe(true);
      }
    }
  });

  it("Draft 1 (Social Launch): flags retired name, unsupported 2x claim, and missing alt text", () => {
    const findings = reviewDraft(
      benchmarkSocialLaunchDraft,
      seedSources,
      seedTerms,
    );
    const sourceIds = findings.map((f) => f.sourceId);

    expect(sourceIds).toContain("TERM-001");
    expect(sourceIds).toContain("CLAIM-001");
    expect(sourceIds).toContain("ACCESS-001");

    const termFinding = findings.find((f) => f.sourceId === "TERM-001")!;
    expect(termFinding.excerpt).toBe("Flowly");
    expect(termFinding.replacement?.to).toBe("NovaDesk");

    const claimFinding = findings.find((f) => f.sourceId === "CLAIM-001")!;
    expect(claimFinding.evidenceStatus).toBe("Evidence needed");
  });

  it("Draft 2 (Clean Announcement): passes with zero findings", () => {
    const findings = reviewDraft(
      benchmarkCleanAnnouncementDraft,
      seedSources,
      seedTerms,
    );
    expect(findings).toHaveLength(0);
  });

  it("Draft 3 (Overpromising Newsletter): detects nuanced hyperbole and qualitative claims in hybrid mode", async () => {
    const result = await reviewDraftHybrid(
      benchmarkOverpromisingNewsletterDraft,
      seedSources,
      seedTerms,
      [],
      { mode: "hybrid" },
    );

    expect(result.findings.length).toBeGreaterThanOrEqual(1);
    const toneFinding = result.findings.find((f) => f.sourceId === "TONE-001");
    expect(toneFinding).toBeDefined();
    expect(toneFinding?.detectedBy).toBe("ai");
  });

  it("Draft 4 (Expired Evidence): flags claim when evidence is expired, suppresses when valid", () => {
    const evidenceSource: Source = {
      id: "EVID-001",
      title: "Demo evidence",
      body: "Reviewer-entered reference",
      version: "1.0",
      updated: "2026-10-26",
      kind: "Evidence",
      status: "Approved",
    };

    const expiredEvidence = [
      {
        id: "evid-expired",
        claim: "3x faster",
        reference: "Internal Study 2024",
        expiresAt: "2024-01-01", // Expired
        sourceId: "EVID-001",
      },
    ];

    const validEvidence = [
      {
        id: "evid-valid",
        claim: "3x faster",
        reference: "Internal Study 2026",
        expiresAt: "2099-01-01", // Valid
        sourceId: "EVID-001",
      },
    ];

    // With expired evidence -> must flag finding
    const findingsWithExpired = reviewDraft(
      benchmarkExpiredEvidenceDraft,
      [...seedSources, evidenceSource],
      seedTerms,
      expiredEvidence,
    );
    expect(findingsWithExpired.some((f) => f.sourceId === "CLAIM-001")).toBe(
      true,
    );

    // With active, unexpired evidence -> must be suppressed
    const findingsWithValid = reviewDraft(
      benchmarkExpiredEvidenceDraft,
      [...seedSources, evidenceSource],
      seedTerms,
      validEvidence,
    );
    expect(findingsWithValid.some((f) => f.sourceId === "CLAIM-001")).toBe(
      false,
    );
  });

  it("Draft 5 (Unapproved Asset): flags unverified SHA-256 hash while keeping accessibility clean", () => {
    const findings = reviewDraft(
      benchmarkUnapprovedAssetDraft,
      seedSources,
      seedTerms,
    );
    expect(findings.some((f) => f.sourceId === "ASSET-001")).toBe(true);
    expect(findings.some((f) => f.sourceId === "ACCESS-001")).toBe(false);
  });

  it("High-Risk Outlandish Copy: extracts multiple distinct claims, flags Critical risk, and provides compliant rewrite", async () => {
    const outlandishText =
      "Flowly guarantees 10x productivity for every team, eliminates 99.9% of workplace inefficiency, and transforms a 40-hour workweek into just 4 hours. Our revolutionary AI is 10,000x smarter than the average employee, predicts your next six months of work with 99.99% accuracy, and completes assignments before you even receive them. Businesses using Flowly experience a guaranteed 500% ROI within 7 days, increase revenue by 847%, and cut operational costs by 95% without hiring additional staff. Our proprietary technology never makes mistakes, never experiences downtime, and delivers results that are 1,000x better than every competitor. Trusted by 50 million companies worldwide, Flowly is the world's first quantum-powered productivity platform capable of turning any startup into a billion-dollar enterprise overnight. No technical expertise, investment, or effort required. Sign up today and experience infinite productivity, unlimited growth, and guaranteed success.";

    const result = await reviewDraftHybrid(
      {
        title: "Outlandish Ad",
        channel: "LinkedIn",
        audience: "Prospects",
        text: outlandishText,
        image: null,
      },
      seedSources,
      seedTerms,
      [],
      { mode: "hybrid" },
    );

    // Verify multi-point extraction: should flag 10+ distinct violations
    expect(result.findings.length).toBeGreaterThanOrEqual(10);
    expect(result.assessment?.riskLevel).toBe("Critical");
    expect(result.assessment?.score).toBeLessThanOrEqual(30);
    expect(result.assessment?.suggestedRewrite).toBeDefined();

    // Verify all key categories are flagged
    const categories = new Set(result.findings.map((f) => f.category));
    expect(categories.has("Terminology")).toBe(true);
    expect(categories.has("Claims")).toBe(true);
    expect(categories.has("Tone")).toBe(true);
    expect(categories.has("Messaging")).toBe(true);
  });
});
