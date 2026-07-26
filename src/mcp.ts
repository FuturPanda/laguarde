import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  actionTypes,
  guidelineKinds,
  type ActionRequest,
} from "./domain.js";
import type { LaguardeService } from "./service.js";

const actionSchema = {
  context_id: z
    .string()
    .optional()
    .describe("Laguarde project context. Defaults to 'default'."),
  summary: z
    .string()
    .min(1)
    .describe("Exact intended action and why it is needed."),
  action_type: z.enum(actionTypes),
  targets: z
    .array(z.string())
    .optional()
    .describe("Repository-relative files or paths the action will touch."),
  commands: z
    .array(z.string())
    .optional()
    .describe("Exact commands intended for execution. Never include secret values."),
  dependencies: z
    .array(z.string())
    .optional()
    .describe("Packages that would be added, removed, or updated."),
  requested_by: z.string().optional().describe("Agent/session identifier."),
};

function jsonContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorContent(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createMcpServer(
  service: LaguardeService,
  options: { projectId?: string } = {},
): McpServer {
  const boundProjectId = options.projectId;
  const server = new McpServer(
    { name: "laguarde", version: "0.3.1" },
    {
      instructions:
        `Laguarde is the team's policy control plane${boundProjectId ? ` for project '${boundProjectId}'` : ""}. At session start, call get_policy_bundle. Before a material action, call evaluate_action. To create an immutable audit record, call record_decision with the same exact action. Never execute forbidden actions or approval-required actions without a human approval recorded in the Laguarde dashboard. When a developer expresses a reusable preference, call list_preference_proposals, then propose_preference. Agents can propose policy changes but cannot ratify them.`,
    },
  );

  server.registerTool(
    "get_policy_bundle",
    {
      description:
        "Return active, context-specific engineering policies with exact revision IDs. Call at the beginning of work and before planning a substantial change.",
      inputSchema: {
        context_id: z.string().optional().default("default"),
        kinds: z.array(z.enum(guidelineKinds)).optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ context_id, kinds }) => {
      try {
        return jsonContent(
          service.getPolicyBundle(boundProjectId ?? context_id, kinds),
        );
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.registerTool(
    "evaluate_action",
    {
      description:
        "Preview the policy decision for an intended action. Returns allowed, limited, approval, or forbidden. This preview is not an audit record; use record_decision before acting.",
      inputSchema: actionSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return jsonContent(
          service.evaluateAction({
            ...(input as unknown as ActionRequest),
            ...(boundProjectId ? { context_id: boundProjectId } : {}),
          }),
        );
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.registerTool(
    "record_decision",
    {
      description:
        "Re-evaluate an exact intended action and persist an immutable audit decision. This tool cannot override policy or self-approve an action.",
      inputSchema: actionSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return jsonContent(
          service.recordDecision({
            ...(input as unknown as ActionRequest),
            ...(boundProjectId ? { context_id: boundProjectId } : {}),
          }),
        );
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  server.registerTool(
    "list_preference_proposals",
    {
      description:
        "List existing preference proposals and observations. Use this before proposing feedback so similar observations converge on one proposal.",
      inputSchema: {
        state: z
          .enum(["pending", "promoted_candidate", "accepted", "rejected"])
          .optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ state }) => {
      const proposals = service.store
        .listProposals(boundProjectId)
        .filter((proposal) => !state || proposal.state === state);
      return jsonContent({ count: proposals.length, proposals });
    },
  );

  server.registerTool(
    "propose_preference",
    {
      description:
        "Capture reusable developer feedback. Add to an existing proposal when it expresses the same preference; otherwise create a new proposal. Three observations promote it for human review, but only a human can accept it.",
      inputSchema: {
        existing_proposal_id: z
          .string()
          .optional()
          .describe("Existing matching proposal, when one was found."),
        scope_kind: z
          .enum(guidelineKinds)
          .optional()
          .describe("Required only when creating a proposal."),
        scope_id: z
          .string()
          .optional()
          .describe("Existing guideline to revise."),
        title: z.string().optional(),
        observation: z.string().min(1),
        suggested_edit: z
          .string()
          .optional()
          .describe("Complete proposed new policy body."),
        proposed_by: z.string().min(1),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return jsonContent(
          service.proposePreference({
            ...input,
            ...(boundProjectId ? { project_id: boundProjectId } : {}),
          }),
        );
      } catch (error) {
        return errorContent(error);
      }
    },
  );

  return server;
}
