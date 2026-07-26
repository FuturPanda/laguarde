import { Router, type Request, type Response } from "express";
import {
  isActionType,
  isGuidelineKind,
  isPolicyLevel,
  type ActionRequest,
  type Guideline,
  type GuidelineFields,
  type GuidelineStatus,
} from "./domain.js";
import type { LaguardeService } from "./service.js";

function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error });
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStatus(value: unknown): value is GuidelineStatus {
  return ["draft", "active", "deprecated"].includes(String(value));
}

export function createApiRouter(service: LaguardeService): Router {
  const router = Router();
  const { store } = service;

  router.get("/contexts", (_req, res) => {
    res.json({ contexts: store.listContexts() });
  });

  router.get("/projects", (_req, res) => {
    const projects = store.listProjects();
    res.json({ count: projects.length, projects });
  });

  router.post("/projects/resolve", (req, res) => {
    const { name, repository_url, root_path, description, tags } =
      req.body as Record<string, unknown>;
    if (
      typeof name !== "string" ||
      !name.trim() ||
      (repository_url !== undefined && typeof repository_url !== "string") ||
      (root_path !== undefined && typeof root_path !== "string") ||
      (description !== undefined && typeof description !== "string") ||
      (tags !== undefined && !stringArray(tags))
    ) {
      badRequest(
        res,
        "name and optional repository_url, root_path, description, and tags are required",
      );
      return;
    }
    if (!repository_url && !root_path) {
      badRequest(res, "repository_url or root_path is required");
      return;
    }
    try {
      const project = store.resolveProject({
        name,
        repository_url:
          typeof repository_url === "string" ? repository_url : undefined,
        root_path: typeof root_path === "string" ? root_path : undefined,
        description:
          typeof description === "string" ? description : undefined,
        tags: tags as string[] | undefined,
      });
      res.status(200).json({
        project,
        mcp_path: `/mcp/projects/${encodeURIComponent(project.id)}`,
      });
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.get("/policy-bundle", (req, res) => {
    try {
      const contextId =
        typeof req.query.context_id === "string"
          ? req.query.context_id
          : "default";
      res.json(service.getPolicyBundle(contextId));
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.get("/guidelines", (req, res) => {
    const kind =
      typeof req.query.kind === "string" &&
      isGuidelineKind(req.query.kind)
        ? req.query.kind
        : undefined;
    const status =
      typeof req.query.status === "string"
        ? (req.query.status as GuidelineStatus)
        : undefined;
    const query =
      typeof req.query.q === "string" ? req.query.q : undefined;
    const projectId =
      typeof req.query.project_id === "string"
        ? req.query.project_id
        : undefined;
    if (projectId && !store.getContext(projectId)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const guidelines = store.listGuidelines({
      kind,
      status,
      query,
      project_id: projectId,
      include_global: true,
    });
    res.json({ count: guidelines.length, guidelines });
  });

  router.get("/guidelines/:id", (req, res) => {
    const guideline = store.getGuideline(req.params.id);
    if (!guideline) {
      res.status(404).json({ error: "Guideline not found" });
      return;
    }
    res.json(guideline);
  });

  router.post("/guidelines", (req, res) => {
    const {
      id,
      kind,
      name,
      summary,
      body,
      tags,
      context_tags,
      status,
      fields,
      author,
      project_id,
    } = req.body as Record<string, unknown>;
    const typedFields = (fields ?? {}) as GuidelineFields;
    if (
      typeof id !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{1,80}$/.test(id) ||
      !isGuidelineKind(kind) ||
      typeof name !== "string" ||
      typeof summary !== "string" ||
      typeof body !== "string"
    ) {
      badRequest(
        res,
        "A safe id, kind, name, summary, and body are required",
      );
      return;
    }
    if (
      (tags !== undefined && !stringArray(tags)) ||
      (context_tags !== undefined && !stringArray(context_tags)) ||
      (status !== undefined && !isStatus(status)) ||
      typeof typedFields !== "object" ||
      typedFields === null ||
      Array.isArray(typedFields)
    ) {
      badRequest(res, "Invalid tags, context_tags, status, or fields");
      return;
    }
    if (
      kind === "general_rule" &&
      !isPolicyLevel(typedFields.level)
    ) {
      badRequest(res, "general_rule fields.level must be a policy level");
      return;
    }
    try {
      const guideline = store.createGuideline({
        id,
        project_id:
          typeof project_id === "string" && project_id !== "default"
            ? project_id
            : null,
        kind,
        name,
        summary,
        body,
        tags: tags ?? [],
        context_tags: context_tags ?? [],
        status: (status as GuidelineStatus | undefined) ?? "active",
        fields: typedFields,
        author: typeof author === "string" ? author : "dashboard",
      });
      res.status(201).json(guideline);
    } catch (error) {
      res.status(409).json({ error: message(error) });
    }
  });

  router.put("/guidelines/:id", (req, res) => {
    const { rationale, author, ...input } = req.body as Record<
      string,
      unknown
    >;
    if (typeof rationale !== "string" || !rationale.trim()) {
      badRequest(res, "A revision rationale is required");
      return;
    }
    const current = store.getGuideline(req.params.id);
    if (!current) {
      res.status(404).json({ error: "Guideline not found" });
      return;
    }
    const changes: Partial<
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
    > = {};
    for (const key of ["name", "summary", "body"] as const) {
      if (input[key] !== undefined) {
        if (typeof input[key] !== "string") {
          badRequest(res, `${key} must be a string`);
          return;
        }
        changes[key] = input[key];
      }
    }
    for (const key of ["tags", "context_tags"] as const) {
      if (input[key] !== undefined) {
        if (!stringArray(input[key])) {
          badRequest(res, `${key} must be an array of strings`);
          return;
        }
        changes[key] = input[key];
      }
    }
    if (input.status !== undefined) {
      if (!isStatus(input.status)) {
        badRequest(res, "status must be draft, active, or deprecated");
        return;
      }
      changes.status = input.status;
    }
    if (input.fields !== undefined) {
      if (
        typeof input.fields !== "object" ||
        input.fields === null ||
        Array.isArray(input.fields)
      ) {
        badRequest(res, "fields must be an object");
        return;
      }
      changes.fields = input.fields as GuidelineFields;
    }
    const nextFields = changes.fields ?? current.fields;
    if (
      current.kind === "general_rule" &&
      !isPolicyLevel(nextFields.level)
    ) {
      badRequest(res, "general_rule fields.level must be a policy level");
      return;
    }
    try {
      const guideline = store.updateGuideline(
        req.params.id,
        changes,
        {
          rationale,
          author: typeof author === "string" ? author : "dashboard",
        },
      );
      res.json(guideline);
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.delete("/guidelines/:id", (req, res) => {
    const deleted = store.softDeleteGuideline(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Guideline not found" });
      return;
    }
    res.json({ deleted: true });
  });

  const parseAction = (
    req: Request,
    res: Response,
  ): ActionRequest | null => {
    const input = req.body as Partial<ActionRequest>;
    if (!input.summary?.trim() || !isActionType(input.action_type)) {
      badRequest(res, "summary and a valid action_type are required");
      return null;
    }
    return input as ActionRequest;
  };

  router.post("/evaluate", (req, res) => {
    const request = parseAction(req, res);
    if (!request) return;
    try {
      res.json(service.evaluateAction(request));
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.post("/decisions", (req, res) => {
    const request = parseAction(req, res);
    if (!request) return;
    try {
      res.status(201).json(service.recordDecision(request));
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.get("/decisions", (req, res) => {
    const projectId =
      typeof req.query.project_id === "string"
        ? req.query.project_id
        : undefined;
    if (projectId && !store.getContext(projectId)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const decisions = store.listDecisions(100, projectId);
    res.json({ count: decisions.length, decisions });
  });

  router.post("/decisions/:id/review", (req, res) => {
    const { status, reviewed_by, note } = req.body as Record<string, unknown>;
    if (
      !["approved", "rejected"].includes(String(status)) ||
      typeof reviewed_by !== "string" ||
      !reviewed_by.trim()
    ) {
      badRequest(res, "status and reviewed_by are required");
      return;
    }
    try {
      const decision = store.reviewDecision(
        req.params.id,
        status as "approved" | "rejected",
        reviewed_by,
        typeof note === "string" ? note : undefined,
      );
      if (!decision) {
        res.status(404).json({ error: "Decision not found" });
        return;
      }
      res.json(decision);
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.get("/proposals", (req, res) => {
    const projectId =
      typeof req.query.project_id === "string"
        ? req.query.project_id
        : undefined;
    if (projectId && !store.getContext(projectId)) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const proposals = store.listProposals(projectId);
    res.json({ count: proposals.length, proposals });
  });

  router.post("/proposals", (req, res) => {
    try {
      res.status(201).json(service.proposePreference(req.body));
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.post("/proposals/:id/observe", (req, res) => {
    const { observation, proposed_by } = req.body as Record<string, unknown>;
    if (
      typeof observation !== "string" ||
      typeof proposed_by !== "string"
    ) {
      badRequest(res, "observation and proposed_by are required");
      return;
    }
    try {
      const proposal = store.addProposalObservation(
        req.params.id,
        observation,
        proposed_by,
      );
      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }
      res.json(proposal);
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  router.post("/proposals/:id/review", (req, res) => {
    const { status, reviewed_by, refined_edit } = req.body as Record<
      string,
      unknown
    >;
    if (
      !["accepted", "rejected"].includes(String(status)) ||
      typeof reviewed_by !== "string" ||
      !reviewed_by.trim()
    ) {
      badRequest(res, "status and reviewed_by are required");
      return;
    }
    try {
      const proposal = store.reviewProposal(
        req.params.id,
        status as "accepted" | "rejected",
        reviewed_by,
        typeof refined_edit === "string" ? refined_edit : undefined,
      );
      if (!proposal) {
        res.status(404).json({ error: "Proposal not found" });
        return;
      }
      res.json(proposal);
    } catch (error) {
      badRequest(res, message(error));
    }
  });

  return router;
}
