import { FINGERPRINT } from "./model";
import type { AppState, DraftBody, DraftRecord, Version } from "./model";

export function editDraft(
  state: AppState,
  draftId: string,
  changes: Partial<DraftBody>,
): AppState {
  const edit = <T extends DraftRecord>(draft: T): T =>
    draft.status === "awaiting"
      ? draft
      : {
          ...draft,
          body: { ...draft.body, ...changes },
          reviewedFingerprint: null,
          status: draft.status === "approved" ? "draft" : draft.status,
        };
  if (state.draftId === draftId) return edit(state);
  return {
    ...state,
    savedDrafts: state.savedDrafts.map((draft) =>
      draft.draftId === draftId ? edit(draft) : draft,
    ),
  };
}

export function snapshotDraft(state: AppState): DraftRecord {
  return structuredClone({
    draftId: state.draftId,
    status: state.status,
    body: state.body,
    findings: state.findings,
    reviewedFingerprint: state.reviewedFingerprint,
    dismissals: state.dismissals,
    versions: state.versions,
    comments: state.comments,
    decisions: state.decisions,
    assessment: state.assessment,
    reviewNotice: state.reviewNotice,
  });
}

export function switchDraft(state: AppState, draftId: string): AppState {
  if (state.draftId === draftId) return state;
  const selected = state.savedDrafts.find((draft) => draft.draftId === draftId);
  if (!selected) return state;
  return {
    ...state,
    ...structuredClone(selected),
    screen: "workspace",
    savedDrafts: [
      snapshotDraft(state),
      ...state.savedDrafts.filter((draft) => draft.draftId !== draftId),
    ],
  };
}

export function createDraft(
  state: AppState,
  draftId: string,
  title: string,
): AppState {
  if (state.persona !== "creator" || !title.trim()) return state;
  if (
    draftId === state.draftId ||
    state.savedDrafts.some((draft) => draft.draftId === draftId)
  )
    return state;
  return {
    ...state,
    draftId,
    status: "draft",
    body: {
      title: title.trim(),
      channel: "LinkedIn",
      audience: "",
      text: "",
      image: null,
    },
    findings: [],
    reviewedFingerprint: null,
    dismissals: [],
    versions: [],
    comments: [],
    decisions: [],
    assessment: null,
    reviewNotice: null,
    savedDrafts: [snapshotDraft(state), ...state.savedDrafts],
    screen: "workspace",
  };
}

// A result applies to its content, approved inputs and evidence date together.
export function reviewFingerprint(
  state: AppState,
  date = new Date().toISOString().slice(0, 10),
) {
  return JSON.stringify([
    state.body,
    state.sources,
    state.terms,
    state.evidence,
    state.approvedAssets,
    state.reviewMode,
    state.geminiModel,
    date,
  ]);
}

export const attentionFindings = (version: Version | undefined) =>
  version?.findings.filter(
    (finding) => finding.severity === "Needs attention",
  ) ?? [];

export function decisionError(
  state: AppState,
  action: "approved" | "changes_requested",
  reason: string,
): string | null {
  const latest = state.versions.at(-1);
  if (state.persona !== "reviewer" || state.status !== "awaiting" || !latest)
    return "Submit a version, then switch to the demo reviewer to decide.";
  if (FINGERPRINT(state.body) !== FINGERPRINT(latest.body))
    return "The content has changed. Submit the current version before deciding.";
  if (action === "changes_requested" && reason.trim().length < 8)
    return "Explain the change request in at least 8 characters.";
  if (
    action === "approved" &&
    attentionFindings(latest).length > 0 &&
    reason.trim().length < 8
  )
    return "Explain why the flagged issues are acceptable before approving this version.";
  return null;
}
