export const guidelineKinds = [
  "code_rule",
  "general_rule",
  "project_init",
  "pr_review_guideline",
] as const;

export const policyLevels = [
  "allowed",
  "limited",
  "approval",
  "forbidden",
] as const;

export const actionTypes = [
  "read",
  "edit",
  "delete",
  "command",
  "dependency",
  "migration",
  "auth",
  "review",
  "bootstrap",
] as const;

export type GuidelineKind = (typeof guidelineKinds)[number];
export type PolicyLevel = (typeof policyLevels)[number];
export type ActionType = (typeof actionTypes)[number];
export type GuidelineStatus = "draft" | "active" | "deprecated";
export type DecisionState =
  | "effective"
  | "pending_approval"
  | "approved"
  | "rejected";
export type ProposalState =
  | "pending"
  | "promoted_candidate"
  | "accepted"
  | "rejected";

export interface MatchFields {
  action_types?: ActionType[];
  target_patterns?: string[];
  target_exclusions?: string[];
  command_patterns?: string[];
  dependency_patterns?: string[];
}

export interface GeneralRuleFields {
  level: PolicyLevel;
  match?: MatchFields;
  evidence?: string[];
}

export interface GuidelineFields extends Record<string, unknown> {
  level?: PolicyLevel;
  match?: MatchFields;
}

export interface Guideline {
  id: string;
  project_id: string | null;
  kind: GuidelineKind;
  name: string;
  summary: string;
  body: string;
  tags: string[];
  context_tags: string[];
  status: GuidelineStatus;
  current_revision_id: string;
  current_revision_no: number;
  fields: GuidelineFields;
  created_at: string;
  updated_at: string;
}

export interface Context {
  id: string;
  name: string;
  description: string | null;
  repository_url: string | null;
  root_path: string | null;
  active_kinds: GuidelineKind[];
  tags: string[];
  created_at: string;
  last_seen_at: string;
}

export interface ProjectSummary extends Context {
  project_policy_count: number;
  decision_count: number;
  open_proposal_count: number;
}

export interface ActionRequest {
  context_id?: string;
  summary: string;
  action_type: ActionType;
  targets?: string[];
  commands?: string[];
  dependencies?: string[];
  requested_by?: string;
}

export interface RuleMatch {
  guideline_id: string;
  revision_id: string;
  name: string;
  level: PolicyLevel;
  reason: string;
}

export interface Evaluation {
  level: PolicyLevel;
  state: DecisionState;
  matched_rules: RuleMatch[];
  rationale: string;
  next_action: string;
}

export interface Decision {
  id: string;
  context_id: string;
  request: ActionRequest;
  evaluation: Evaluation;
  decision_level: PolicyLevel;
  state: DecisionState;
  reviewed_by: string | null;
  review_note: string | null;
  related_guideline_revisions: string[];
  next_action: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface Proposal {
  id: string;
  project_id: string;
  scope_kind: GuidelineKind;
  scope_id: string | null;
  title: string;
  suggested_edit: string;
  state: ProposalState;
  convergence_count: number;
  proposed_by: string[];
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProposalObservation {
  id: string;
  proposal_id: string;
  observation: string;
  proposed_by: string;
  created_at: string;
}

export interface ProposalWithObservations extends Proposal {
  observations: ProposalObservation[];
}

export const levelRank: Record<PolicyLevel, number> = {
  allowed: 0,
  limited: 1,
  approval: 2,
  forbidden: 3,
};

export function isGuidelineKind(value: unknown): value is GuidelineKind {
  return (
    typeof value === "string" &&
    guidelineKinds.includes(value as GuidelineKind)
  );
}

export function isPolicyLevel(value: unknown): value is PolicyLevel {
  return (
    typeof value === "string" &&
    policyLevels.includes(value as PolicyLevel)
  );
}

export function isActionType(value: unknown): value is ActionType {
  return (
    typeof value === "string" && actionTypes.includes(value as ActionType)
  );
}
