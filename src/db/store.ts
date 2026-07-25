import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  guidelineKinds,
  type ActionRequest,
  type Context,
  type Decision,
  type DecisionState,
  type Evaluation,
  type Guideline,
  type GuidelineFields,
  type GuidelineKind,
  type GuidelineStatus,
  type Proposal,
  type ProposalObservation,
  type ProposalState,
  type ProposalWithObservations,
} from "../domain.js";
import { seedStore } from "./seed.js";
import { Database } from "./database.js";
import { initializeSchema } from "./schema.js";

interface StoreOptions {
  seed?: boolean;
  evidenceDir?: string | null;
}

interface GuidelineRow {
  id: string;
  kind: GuidelineKind;
  name: string;
  summary: string;
  tags: string;
  context_tags: string;
  status: GuidelineStatus;
  current_revision_id: string;
  fields: string;
  created_at: string;
  updated_at: string;
  body: string;
  revision_no: number;
}

interface ContextRow {
  id: string;
  name: string;
  description: string | null;
  active_kinds: string;
  tags: string;
  created_at: string;
}

interface DecisionRow {
  id: string;
  context_id: string;
  request_json: string;
  evaluation_json: string;
  decision_level: Decision["decision_level"];
  state: DecisionState;
  reviewed_by: string | null;
  review_note: string | null;
  related_guideline_revisions: string;
  next_action: string;
  created_at: string;
  reviewed_at: string | null;
}

interface ProposalRow {
  id: string;
  scope_kind: GuidelineKind;
  scope_id: string | null;
  title: string;
  suggested_edit: string;
  state: ProposalState;
  convergence_count: number;
  proposed_by: string;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

function now(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

const proposalKindPrefixes: Record<GuidelineKind, string> = {
  code_rule: "code",
  general_rule: "guard",
  project_init: "init",
  pr_review_guideline: "review",
};

function proposalSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : "feedback-policy";
}

function mapGuideline(row: GuidelineRow): Guideline {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    summary: row.summary,
    body: row.body,
    tags: parseJson<string[]>(row.tags),
    context_tags: parseJson<string[]>(row.context_tags),
    status: row.status,
    current_revision_id: row.current_revision_id,
    current_revision_no: row.revision_no,
    fields: parseJson<GuidelineFields>(row.fields),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapContext(row: ContextRow): Context {
  return {
    ...row,
    active_kinds: parseJson<GuidelineKind[]>(row.active_kinds),
    tags: parseJson<string[]>(row.tags),
  };
}

function mapDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    context_id: row.context_id,
    request: parseJson<ActionRequest>(row.request_json),
    evaluation: parseJson<Evaluation>(row.evaluation_json),
    decision_level: row.decision_level,
    state: row.state,
    reviewed_by: row.reviewed_by,
    review_note: row.review_note,
    related_guideline_revisions: parseJson<string[]>(
      row.related_guideline_revisions,
    ),
    next_action: row.next_action,
    created_at: row.created_at,
    reviewed_at: row.reviewed_at,
  };
}

function mapProposal(row: ProposalRow): Proposal {
  return {
    ...row,
    proposed_by: parseJson<string[]>(row.proposed_by),
  };
}

export class PolicyStore {
  readonly db: Database;
  private readonly evidenceDir: string | null;

  constructor(path: string, options: StoreOptions = {}) {
    this.db = new Database(path);
    this.evidenceDir =
      options.evidenceDir === undefined
        ? join(process.cwd(), "decisions")
        : options.evidenceDir;
    initializeSchema(this.db);
    if (options.seed !== false) seedStore(this);
  }

  close(): void {
    this.db.close();
  }

  guidelineCount(): number {
    const row = this.db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM guidelines")
      .get();
    return row?.count ?? 0;
  }

  createContext(input: {
    id: string;
    name: string;
    description?: string;
    active_kinds?: GuidelineKind[];
    tags?: string[];
  }): Context {
    const createdAt = now();
    this.db
      .query(
        `INSERT INTO contexts
          (id, name, description, active_kinds, tags, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.name,
        input.description ?? null,
        stringify(input.active_kinds ?? [...guidelineKinds]),
        stringify(input.tags ?? []),
        createdAt,
      );
    return this.getContext(input.id)!;
  }

  getContext(id: string): Context | null {
    const row = this.db
      .query<ContextRow, [string]>("SELECT * FROM contexts WHERE id = ?")
      .get(id);
    return row ? mapContext(row) : null;
  }

  listContexts(): Context[] {
    return this.db
      .query<ContextRow, []>("SELECT * FROM contexts ORDER BY name")
      .all()
      .map(mapContext);
  }

  createGuideline(input: {
    id: string;
    kind: GuidelineKind;
    name: string;
    summary: string;
    body: string;
    tags?: string[];
    context_tags?: string[];
    status?: GuidelineStatus;
    fields?: GuidelineFields;
    rationale?: string;
    author?: string;
  }): Guideline {
    const createdAt = now();
    const revisionId = `${input.id}#v1`;
    const fields = input.fields ?? {};
    const insert = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO guidelines
            (id, kind, name, summary, tags, context_tags, status,
             current_revision_id, fields, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          input.id,
          input.kind,
          input.name,
          input.summary,
          stringify(input.tags ?? []),
          stringify(input.context_tags ?? []),
          input.status ?? "active",
          revisionId,
          stringify(fields),
          createdAt,
          createdAt,
        );
      this.db
        .query(
          `INSERT INTO guideline_revisions
            (id, guideline_id, revision_no, body, fields, rationale, author, created_at)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        )
        .run(
          revisionId,
          input.id,
          input.body,
          stringify(fields),
          input.rationale ?? "Initial policy",
          input.author ?? "system",
          createdAt,
        );
    });
    insert();
    return this.getGuideline(input.id)!;
  }

  getGuideline(id: string): Guideline | null {
    const row = this.db
      .query<GuidelineRow, [string]>(
        `SELECT g.*, r.body, r.revision_no
         FROM guidelines g
         JOIN guideline_revisions r ON r.id = g.current_revision_id
         WHERE g.id = ? AND g.deleted_at IS NULL`,
      )
      .get(id);
    return row ? mapGuideline(row) : null;
  }

  listGuidelines(filters: {
    kind?: GuidelineKind;
    status?: GuidelineStatus;
    query?: string;
  } = {}): Guideline[] {
    const conditions = ["g.deleted_at IS NULL"];
    const params: string[] = [];
    if (filters.kind) {
      conditions.push("g.kind = ?");
      params.push(filters.kind);
    }
    if (filters.status) {
      conditions.push("g.status = ?");
      params.push(filters.status);
    }
    if (filters.query) {
      conditions.push(
        "(g.id LIKE ? OR g.name LIKE ? OR g.summary LIKE ? OR r.body LIKE ?)",
      );
      const search = `%${filters.query}%`;
      params.push(search, search, search, search);
    }

    return this.db
      .query<GuidelineRow, string[]>(
        `SELECT g.*, r.body, r.revision_no
         FROM guidelines g
         JOIN guideline_revisions r ON r.id = g.current_revision_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY g.kind, g.name`,
      )
      .all(...params)
      .map(mapGuideline);
  }

  updateGuideline(
    id: string,
    changes: Partial<
      Pick<
        Guideline,
        | "name"
        | "summary"
        | "body"
        | "tags"
        | "context_tags"
        | "status"
        | "fields"
      >
    >,
    metadata: { rationale: string; author: string },
  ): Guideline | null {
    const current = this.getGuideline(id);
    if (!current) return null;
    const revisionNo = current.current_revision_no + 1;
    const revisionId = `${id}#v${revisionNo}`;
    const updatedAt = now();
    const next = { ...current, ...changes };

    const update = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO guideline_revisions
            (id, guideline_id, revision_no, body, fields, rationale, author, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          revisionId,
          id,
          revisionNo,
          next.body,
          stringify(next.fields),
          metadata.rationale,
          metadata.author,
          updatedAt,
        );
      this.db
        .query(
          `UPDATE guidelines SET
            name = ?, summary = ?, tags = ?, context_tags = ?, status = ?,
            current_revision_id = ?, fields = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          next.name,
          next.summary,
          stringify(next.tags),
          stringify(next.context_tags),
          next.status,
          revisionId,
          stringify(next.fields),
          updatedAt,
          id,
        );
    });
    update();
    return this.getGuideline(id);
  }

  softDeleteGuideline(id: string): boolean {
    const result = this.db
      .query(
        `UPDATE guidelines
         SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
      )
      .run(now(), now(), id);
    return result.changes > 0;
  }

  applicableGuidelines(contextId = "default"): Guideline[] {
    const context = this.getContext(contextId);
    if (!context) throw new Error(`Context '${contextId}' not found`);
    return this.listGuidelines({ status: "active" }).filter((guideline) => {
      const activeKind = context.active_kinds.includes(guideline.kind);
      const appliesEverywhere = guideline.context_tags.length === 0;
      const matchingTag = guideline.context_tags.some((tag) =>
        context.tags.includes(tag),
      );
      return activeKind && (appliesEverywhere || matchingTag);
    });
  }

  createDecision(
    request: ActionRequest,
    evaluation: Evaluation,
  ): Decision {
    const id = `dec-${randomUUID()}`;
    const createdAt = now();
    const contextId = request.context_id ?? "default";
    if (!this.getContext(contextId)) {
      throw new Error(`Context '${contextId}' not found`);
    }
    const revisions = evaluation.matched_rules.map(
      (match) => match.revision_id,
    );
    this.db
      .query(
        `INSERT INTO decisions
          (id, context_id, request_json, evaluation_json, decision_level, state,
           related_guideline_revisions, next_action, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        contextId,
        stringify({ ...request, context_id: contextId }),
        stringify(evaluation),
        evaluation.level,
        evaluation.state,
        stringify(revisions),
        evaluation.next_action,
        createdAt,
      );
    const decision = this.getDecision(id)!;
    this.writeDecisionEvidence(decision);
    return decision;
  }

  getDecision(id: string): Decision | null {
    const row = this.db
      .query<DecisionRow, [string]>("SELECT * FROM decisions WHERE id = ?")
      .get(id);
    return row ? mapDecision(row) : null;
  }

  listDecisions(limit = 100): Decision[] {
    return this.db
      .query<DecisionRow, [number]>(
        "SELECT * FROM decisions ORDER BY created_at DESC LIMIT ?",
      )
      .all(limit)
      .map(mapDecision);
  }

  reviewDecision(
    id: string,
    status: "approved" | "rejected",
    reviewedBy: string,
    note?: string,
  ): Decision | null {
    const decision = this.getDecision(id);
    if (!decision) return null;
    if (decision.decision_level !== "approval") {
      throw new Error("Only approval-required decisions can be reviewed");
    }
    if (decision.state !== "pending_approval") {
      throw new Error(`Decision has already been ${decision.state}`);
    }
    this.db
      .query(
        `UPDATE decisions
         SET state = ?, reviewed_by = ?, review_note = ?, reviewed_at = ?
         WHERE id = ?`,
      )
      .run(status, reviewedBy, note ?? null, now(), id);
    const reviewed = this.getDecision(id)!;
    this.writeDecisionEvidence(reviewed);
    return reviewed;
  }

  createProposal(input: {
    scope_kind: GuidelineKind;
    scope_id?: string;
    title: string;
    observation: string;
    suggested_edit: string;
    proposed_by: string;
  }): ProposalWithObservations {
    if (input.scope_id) {
      const guideline = this.getGuideline(input.scope_id);
      if (!guideline) {
        throw new Error(`Guideline '${input.scope_id}' not found`);
      }
      if (guideline.kind !== input.scope_kind) {
        throw new Error(
          `Guideline '${input.scope_id}' is ${guideline.kind}, not ${input.scope_kind}`,
        );
      }
    }
    const id = `prop-${randomUUID()}`;
    const createdAt = now();
    const insert = this.db.transaction(() => {
      this.db
        .query(
          `INSERT INTO proposals
            (id, scope_kind, scope_id, title, suggested_edit, state,
             convergence_count, proposed_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'pending', 1, ?, ?, ?)`,
        )
        .run(
          id,
          input.scope_kind,
          input.scope_id ?? null,
          input.title,
          input.suggested_edit,
          stringify([input.proposed_by]),
          createdAt,
          createdAt,
        );
      this.insertObservation(
        id,
        input.observation,
        input.proposed_by,
        createdAt,
      );
    });
    insert();
    return this.getProposal(id)!;
  }

  addProposalObservation(
    id: string,
    observation: string,
    proposedBy: string,
  ): ProposalWithObservations | null {
    const proposal = this.getProposal(id);
    if (!proposal) return null;
    if (!["pending", "promoted_candidate"].includes(proposal.state)) {
      throw new Error(`Proposal is already ${proposal.state}`);
    }
    const createdAt = now();
    const nextCount = proposal.convergence_count + 1;
    const nextState =
      nextCount >= 3 ? "promoted_candidate" : proposal.state;
    const contributors = [...proposal.proposed_by, proposedBy];

    const update = this.db.transaction(() => {
      this.insertObservation(id, observation, proposedBy, createdAt);
      this.db
        .query(
          `UPDATE proposals
           SET convergence_count = ?, state = ?, proposed_by = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(
          nextCount,
          nextState,
          stringify(contributors),
          createdAt,
          id,
        );
    });
    update();
    return this.getProposal(id);
  }

  private insertObservation(
    proposalId: string,
    observation: string,
    proposedBy: string,
    createdAt: string,
  ): void {
    this.db
      .query(
        `INSERT INTO proposal_observations
          (id, proposal_id, observation, proposed_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        `obs-${randomUUID()}`,
        proposalId,
        observation,
        proposedBy,
        createdAt,
      );
  }

  getProposal(id: string): ProposalWithObservations | null {
    const row = this.db
      .query<ProposalRow, [string]>("SELECT * FROM proposals WHERE id = ?")
      .get(id);
    if (!row) return null;
    const observations = this.db
      .query<ProposalObservation, [string]>(
        `SELECT * FROM proposal_observations
         WHERE proposal_id = ? ORDER BY created_at`,
      )
      .all(id);
    return { ...mapProposal(row), observations };
  }

  listProposals(): ProposalWithObservations[] {
    const rows = this.db
      .query<ProposalRow, []>(
        `SELECT * FROM proposals
         ORDER BY
           CASE state
             WHEN 'promoted_candidate' THEN 0
             WHEN 'pending' THEN 1
             ELSE 2
           END,
           updated_at DESC`,
      )
      .all();
    return rows.map((row) => this.getProposal(row.id)!);
  }

  reviewProposal(
    id: string,
    status: "accepted" | "rejected",
    reviewedBy: string,
    refinedEdit?: string,
  ): ProposalWithObservations | null {
    const proposal = this.getProposal(id);
    if (!proposal) return null;
    if (!["pending", "promoted_candidate"].includes(proposal.state)) {
      throw new Error(`Proposal is already ${proposal.state}`);
    }
    const acceptedEdit = refinedEdit?.trim() || proposal.suggested_edit;
    const update = this.db.transaction(() => {
      if (status === "accepted") {
        if (!proposal.scope_id) {
          const guidelineId = this.nextProposalGuidelineId(
            proposal.scope_kind,
            proposal.title,
          );
          const latestObservation = proposal.observations.at(-1)?.observation;
          this.createGuideline({
            id: guidelineId,
            kind: proposal.scope_kind,
            name: proposal.title,
            summary: latestObservation ?? proposal.title,
            body: acceptedEdit,
            tags: ["feedback"],
            status: "active",
            fields:
              proposal.scope_kind === "general_rule"
                ? { level: "limited" }
                : {},
            rationale: `Merged proposal ${proposal.id}: ${proposal.title}`,
            author: reviewedBy,
          });
          this.db
            .query("UPDATE proposals SET scope_id = ? WHERE id = ?")
            .run(guidelineId, proposal.id);
        } else {
          this.updateGuideline(
            proposal.scope_id,
            { body: acceptedEdit },
            {
              rationale: `Merged proposal ${proposal.id}: ${proposal.title}`,
              author: reviewedBy,
            },
          );
        }
      }
      this.db
        .query(
          `UPDATE proposals
           SET state = ?, suggested_edit = ?, reviewed_by = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(status, acceptedEdit, reviewedBy, now(), id);
    });
    update();
    return this.getProposal(id);
  }

  private nextProposalGuidelineId(
    kind: GuidelineKind,
    title: string,
  ): string {
    const base = `${proposalKindPrefixes[kind]}-${proposalSlug(title)}`;
    let candidate = base;
    let suffix = 2;
    while (
      this.db
        .query<{ present: number }, [string]>(
          "SELECT 1 AS present FROM guidelines WHERE id = ?",
        )
        .get(candidate)
    ) {
      const suffixText = `-${suffix}`;
      candidate = `${base.slice(0, 80 - suffixText.length)}${suffixText}`;
      suffix += 1;
    }
    return candidate;
  }

  private writeDecisionEvidence(decision: Decision): void {
    if (!this.evidenceDir) return;
    mkdirSync(this.evidenceDir, { recursive: true });
    const timestamp = decision.created_at.replaceAll(":", "-");
    const path = join(this.evidenceDir, `${timestamp}-${decision.id}.md`);
    const matched = decision.evaluation.matched_rules.length
      ? decision.evaluation.matched_rules
          .map(
            (rule) =>
              `- \`${rule.guideline_id}\` at \`${rule.revision_id}\`: **${rule.level}** (${rule.reason})`,
          )
          .join("\n")
      : "- No explicit rule matched; fail-safe default applied.";
    const targets = decision.request.targets?.length
      ? decision.request.targets.map((target) => `\`${target}\``).join(", ")
      : "_none declared_";

    writeFileSync(
      path,
      `# Laguarde decision ${decision.id}

- Created: ${decision.created_at}
- Context: \`${decision.context_id}\`
- Action: \`${decision.request.action_type}\`
- Level: **${decision.decision_level}**
- State: **${decision.state}**
- Requested by: ${decision.request.requested_by ?? "unknown"}
- Targets: ${targets}

## Request

${decision.request.summary}

## Applied policy revisions

${matched}

## Evaluation

${decision.evaluation.rationale}

## Next action

${decision.next_action}

## Human review

- Reviewed by: ${decision.reviewed_by ?? "_pending / not required_"}
- Reviewed at: ${decision.reviewed_at ?? "_pending / not required_"}
- Note: ${decision.review_note ?? "_none_"}
`,
    );
  }
}
