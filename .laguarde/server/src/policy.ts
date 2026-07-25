import {
  levelRank,
  type ActionRequest,
  type Evaluation,
  type Guideline,
  type MatchFields,
  type PolicyLevel,
  type RuleMatch,
} from "./domain.js";

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

export function globMatches(pattern: string, value: string): boolean {
  const marker = "\u0000";
  const expression = escapeRegex(pattern)
    .replaceAll("**", marker)
    .replaceAll("*", "[^/]*")
    .replaceAll(marker, ".*");
  return new RegExp(`^${expression}$`, "i").test(value);
}

function anyGlob(patterns: string[], values: string[]): boolean {
  return patterns.some((pattern) =>
    values.some((value) => globMatches(pattern, value)),
  );
}

function anyText(patterns: string[], values: string[]): boolean {
  return patterns.some((pattern) =>
    values.some((value) =>
      value.toLocaleLowerCase().includes(pattern.toLocaleLowerCase()),
    ),
  );
}

export function ruleMatches(
  match: MatchFields | undefined,
  request: ActionRequest,
): { matched: boolean; reasons: string[] } {
  if (!match) return { matched: true, reasons: ["applies to every action"] };

  const reasons: string[] = [];
  const targets = request.targets ?? [];
  const commands = request.commands ?? [];
  const dependencies = request.dependencies ?? [];

  if (
    match.action_types?.length &&
    !match.action_types.includes(request.action_type)
  ) {
    return { matched: false, reasons: [] };
  }
  if (match.action_types?.length) {
    reasons.push(`action type '${request.action_type}'`);
  }

  const targetCandidates = match.target_exclusions?.length
    ? targets.filter(
        (target) => !anyGlob(match.target_exclusions!, [target]),
      )
    : targets;
  if (
    match.target_patterns?.length &&
    !anyGlob(match.target_patterns, targetCandidates)
  ) {
    return { matched: false, reasons: [] };
  }
  if (match.target_patterns?.length) {
    reasons.push("target path");
  }

  if (
    match.command_patterns?.length &&
    !anyText(match.command_patterns, commands)
  ) {
    return { matched: false, reasons: [] };
  }
  if (match.command_patterns?.length) {
    reasons.push("command content");
  }

  if (
    match.dependency_patterns?.length &&
    !anyGlob(match.dependency_patterns, dependencies)
  ) {
    return { matched: false, reasons: [] };
  }
  if (match.dependency_patterns?.length) {
    reasons.push("dependency");
  }

  return {
    matched: true,
    reasons: reasons.length ? reasons : ["applies to every action"],
  };
}

function stateFor(level: PolicyLevel): Evaluation["state"] {
  return level === "approval" ? "pending_approval" : "effective";
}

function nextActionFor(level: PolicyLevel): string {
  switch (level) {
    case "allowed":
      return "Proceed within the declared scope and record test evidence.";
    case "limited":
      return "Narrow or split the change, then submit the refined action again.";
    case "approval":
      return "Wait for a human to approve this exact action in Laguarde.";
    case "forbidden":
      return "Do not execute. Propose a safe alternative that avoids the forbidden operation.";
  }
}

export function evaluateAgainstRules(
  request: ActionRequest,
  guidelines: Guideline[],
): Evaluation {
  const matches: RuleMatch[] = [];

  for (const guideline of guidelines) {
    if (guideline.kind !== "general_rule" || guideline.status !== "active") {
      continue;
    }
    const level = guideline.fields.level;
    if (!level) continue;

    const result = ruleMatches(guideline.fields.match, request);
    if (!result.matched) continue;

    matches.push({
      guideline_id: guideline.id,
      revision_id: guideline.current_revision_id,
      name: guideline.name,
      level,
      reason: result.reasons.join(", "),
    });
  }

  matches.sort((left, right) => levelRank[right.level] - levelRank[left.level]);
  const level = matches[0]?.level ?? "limited";
  const rationale = matches.length
    ? `Highest applicable policy level is '${level}'. Matched: ${matches
        .map((match) => `${match.guideline_id} (${match.level})`)
        .join(", ")}.`
    : "No explicit policy matched. Laguarde fails safely with a limited decision.";

  return {
    level,
    state: stateFor(level),
    matched_rules: matches,
    rationale,
    next_action: nextActionFor(level),
  };
}
