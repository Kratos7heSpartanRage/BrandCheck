import { describe, expect, it } from "vitest";
import { demoBody, seedSources, seedTerms } from "./model";
import { reviewDraft } from "./review";

describe("source-backed review", () => {
  it("finds the guided demo issues without declaring an unsupported claim false", () => {
    const findings = reviewDraft(demoBody, seedSources, seedTerms);
    expect(findings.map((finding) => finding.sourceId)).toEqual(
      expect.arrayContaining(["TERM-001", "CLAIM-001", "ACCESS-001"]),
    );
    const term = findings.find((finding) => finding.sourceId === "TERM-001")!;
    expect(term.excerpt).toBe("Flowly");
    expect(term.replacement?.to).toBe("NovaDesk");
    const claim = findings.find((finding) => finding.sourceId === "CLAIM-001")!;
    expect(claim.evidenceStatus).toBe("Evidence needed");
    expect(claim.explanation).toContain(
      "not determined whether it is true or false",
    );
  });

  it("returns no issues for an approved plain-language draft", () => {
    const body = structuredClone(demoBody);
    body.text = "Meet NovaDesk, designed to simplify daily work.";
    body.image!.alt = "Illustration of the NovaDesk planning workspace.";
    expect(reviewDraft(body, seedSources, seedTerms)).toEqual([]);
  });

  it("does not cite retired source material", () => {
    const sources = seedSources.map((source) =>
      source.id === "TERM-001"
        ? { ...source, status: "Retired" as const }
        : source,
    );
    expect(
      reviewDraft(demoBody, sources, seedTerms).some(
        (finding) => finding.sourceId === "TERM-001",
      ),
    ).toBe(false);
  });

  it("routes an unapproved upload to a reviewer and accepts decorative images", () => {
    const body = structuredClone(demoBody);
    body.image = {
      name: "ad.png",
      mime: "image/png",
      bytes: 99,
      sha256: "unknown",
      alt: "",
      decorative: true,
      source: "upload",
    };
    const findings = reviewDraft(body, seedSources, seedTerms);
    expect(findings.some((finding) => finding.sourceId === "ASSET-001")).toBe(
      true,
    );
    expect(findings.some((finding) => finding.sourceId === "ACCESS-001")).toBe(
      false,
    );
  });

  it("uses only active, unexpired exact claim evidence", () => {
    const activeSource = {
      id: "EVID-001",
      title: "Demo evidence",
      body: "Reviewer-entered reference",
      version: "1.0",
      updated: "2026-10-26",
      kind: "Evidence" as const,
      status: "Approved" as const,
    };
    const evidence = [
      {
        id: "e1",
        claim: "2x productivity",
        reference: "Test report",
        expiresAt: "2099-01-01",
        sourceId: "EVID-001",
      },
    ];
    expect(
      reviewDraft(
        demoBody,
        [...seedSources, activeSource],
        seedTerms,
        evidence,
      ).some((finding) => finding.sourceId === "CLAIM-001"),
    ).toBe(false);
    expect(
      reviewDraft(demoBody, [...seedSources, activeSource], seedTerms, [
        { ...evidence[0], expiresAt: "2020-01-01" },
      ]).some((finding) => finding.sourceId === "CLAIM-001"),
    ).toBe(true);
  });

  it("checks every quantified claim independently", () => {
    const body = structuredClone(demoBody);
    body.text = "NovaDesk offers 2x productivity and 30% savings.";
    const findings = reviewDraft(body, seedSources, seedTerms);
    expect(
      findings.filter((finding) => finding.category === "Claims"),
    ).toHaveLength(2);
  });

  it("accepts an exact reviewer-approved asset fingerprint", () => {
    const body = structuredClone(demoBody);
    body.text = "Meet NovaDesk.";
    body.image = {
      name: "campaign.png",
      mime: "image/png",
      bytes: 100,
      sha256: "approved-fingerprint",
      alt: "A NovaDesk campaign visual",
      decorative: false,
      source: "upload",
    };
    expect(
      reviewDraft(
        body,
        seedSources,
        seedTerms,
        [],
        [
          {
            sha256: "approved-fingerprint",
            name: "campaign.png",
            approvedAt: "2026-10-26T10:00:00.000Z",
            sourceId: "ASSET-001",
          },
        ],
      ),
    ).toEqual([]);
  });
});
