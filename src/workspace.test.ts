import { describe, expect, it } from "vitest";
import { makeInitialState } from "./model";
import type { AppState } from "./model";
import { reviewDraft } from "./review";
import {
  createDraft,
  decisionError,
  editDraft,
  reviewFingerprint,
  switchDraft,
} from "./workspace";

function submittedState(): AppState {
  const state = makeInitialState();
  state.persona = "reviewer";
  state.status = "awaiting";
  state.versions = [
    {
      id: 1,
      at: "2026-10-27T10:00:00Z",
      by: "creator",
      body: structuredClone(state.body),
      findings: reviewDraft(state.body, state.sources, state.terms),
      dismissals: [],
      note: "Submitted for approval",
    },
  ];
  return state;
}

describe("independent content workflows", () => {
  it("preserves a submitted draft while another draft is written", () => {
    const original = submittedState();
    original.persona = "creator";
    original.comments = [
      {
        id: "c1",
        by: "creator",
        at: "2026-10-27T10:01:00Z",
        versionId: 1,
        text: "Please review the launch claim.",
      },
    ];
    let state = createDraft(original, "newsletter", "Customer newsletter");
    state = editDraft(state, "newsletter", { text: "Meet NovaDesk." });
    expect(state.versions).toEqual([]);
    expect(state.comments).toEqual([]);
    state = switchDraft(state, original.draftId);
    expect(state.status).toBe("awaiting");
    expect(state.versions).toEqual(original.versions);
    expect(state.comments).toEqual(original.comments);
    expect(state.body.text).toBe(original.body.text);
    expect(switchDraft(state, "newsletter").body.text).toBe("Meet NovaDesk.");
  });

  it("keeps a delayed file import attached to the draft it came from", () => {
    const original = makeInitialState();
    let state = createDraft(original, "second", "Second draft");
    state = editDraft(state, original.draftId, { text: "Imported draft text" });
    expect(state.body.text).toBe("");
    expect(switchDraft(state, original.draftId).body.text).toBe(
      "Imported draft text",
    );
    expect(original.body.text).not.toBe("Imported draft text");
  });

  it("protects submitted content and removes approval when an approved draft is edited", () => {
    const submitted = submittedState();
    expect(
      editDraft(submitted, submitted.draftId, { text: "Altered content" }).body,
    ).toEqual(submitted.body);
    const approved = { ...submitted, status: "approved" as const };
    const edited = editDraft(approved, approved.draftId, {
      text: "A new version",
    });
    expect(edited.status).toBe("draft");
    expect(edited.reviewedFingerprint).toBeNull();
    expect(edited.versions[0].body).toEqual(approved.body);
  });

  it("requires a fresh check after shared guidelines change or the evidence date advances", () => {
    const original = makeInitialState();
    const fingerprint = reviewFingerprint(original, "2026-10-27");
    let state = createDraft(original, "second", "Second draft");
    state = {
      ...state,
      terms: [
        ...state.terms,
        {
          id: "t2",
          sourceId: "TERM-001",
          retired: "OldDesk",
          preferred: "NovaDesk",
        },
      ],
    };
    state = switchDraft(state, original.draftId);
    expect(reviewFingerprint(state, "2026-10-27")).not.toBe(fingerprint);
    expect(reviewFingerprint(original, "2026-10-28")).not.toBe(fingerprint);
  });
});

describe("reviewer decisions", () => {
  it("requires an explanation to approve flagged issues even if the creator dismissed them", () => {
    const state = submittedState();
    state.versions[0].dismissals = state.versions[0].findings.map(
      (finding) => ({
        findingId: finding.id,
        reason: "Please accept this exception.",
      }),
    );
    expect(decisionError(state, "approved", "")).toContain("Explain why");
    expect(
      decisionError(
        state,
        "approved",
        "Verified the claim scope and accepted the exception.",
      ),
    ).toBeNull();
  });

  it("allows a clean version to be approved and refuses a decision on different content", () => {
    const state = submittedState();
    state.versions[0].findings = [];
    expect(decisionError(state, "approved", "")).toBeNull();
    state.body = { ...state.body, text: "Changed after submission" };
    expect(decisionError(state, "approved", "Looks good to publish")).toContain(
      "content has changed",
    );
  });
});
