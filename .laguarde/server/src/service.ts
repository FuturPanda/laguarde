import {
  isGuidelineKind,
  type ActionRequest,
  type Evaluation,
  type GuidelineKind,
  type ProposalWithObservations,
} from "./domain.js";
import type { PolicyStore } from "./db/store.js";
import { evaluateAgainstRules } from "./policy.js";

export class LaguardeService {
  constructor(readonly store: PolicyStore) {}

  getPolicyBundle(
    contextId = "default",
    kinds?: GuidelineKind[],
  ): {
    context: ReturnType<PolicyStore["getContext"]>;
    guidelines: ReturnType<PolicyStore["applicableGuidelines"]>;
  } {
    const context = this.store.getContext(contextId);
    if (!context) throw new Error(`Context '${contextId}' not found`);
    const guidelines = this.store
      .applicableGuidelines(contextId)
      .filter((guideline) => !kinds || kinds.includes(guideline.kind));
    return { context, guidelines };
  }

  evaluateAction(request: ActionRequest): Evaluation {
    const contextId = request.context_id ?? "default";
    const rules = this.store.applicableGuidelines(contextId);
    return evaluateAgainstRules(request, rules);
  }

  recordDecision(request: ActionRequest) {
    const evaluation = this.evaluateAction(request);
    return this.store.createDecision(request, evaluation);
  }

  proposePreference(input: {
    existing_proposal_id?: string;
    scope_kind?: string;
    scope_id?: string;
    title?: string;
    observation: string;
    suggested_edit?: string;
    proposed_by: string;
  }): ProposalWithObservations {
    if (input.existing_proposal_id) {
      const proposal = this.store.addProposalObservation(
        input.existing_proposal_id,
        input.observation,
        input.proposed_by,
      );
      if (!proposal) {
        throw new Error(
          `Proposal '${input.existing_proposal_id}' not found`,
        );
      }
      return proposal;
    }

    if (!isGuidelineKind(input.scope_kind)) {
      throw new Error("A valid scope_kind is required for a new proposal");
    }
    if (!input.title?.trim() || !input.suggested_edit?.trim()) {
      throw new Error(
        "title and suggested_edit are required for a new proposal",
      );
    }
    return this.store.createProposal({
      scope_kind: input.scope_kind,
      scope_id: input.scope_id,
      title: input.title,
      observation: input.observation,
      suggested_edit: input.suggested_edit,
      proposed_by: input.proposed_by,
    });
  }
}
