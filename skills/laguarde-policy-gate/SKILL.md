---
name: laguarde-policy-gate
description: Enforce a fail-closed Laguarde policy workflow for software-engineering agents. Use whenever a project has a Laguarde MCP server, the user mentions Laguarde or team policies, or before editing files, running state-changing commands, installing dependencies, changing Git state, deploying, accessing sensitive data, or performing another material action in a Laguarde-governed workspace.
---

# Laguarde Policy Gate

Treat Laguarde as a mandatory decision gate. Never perform a material action
until the project-bound Laguarde server has supplied the applicable policies and
allowed that exact action.

## Fail-closed invariant

Permit only user conversation and the minimum read-only inspection needed to
find the repository, connect Laguarde, read policies, and describe the intended
action. Do not edit or delete files, change Git state, install packages, run a
state-changing command, make an external mutation, deploy, migrate data, or
access secrets until the gate succeeds.

If Laguarde is missing, unhealthy, unbound, returns an error, supplies no active
policy, or cannot record a decision, stop before the material action. Explain
what failed and ask the human to connect or repair Laguarde. Do not silently
fall back to personal judgment or a generic policy set.

Do not install or reconfigure Laguarde unless the human explicitly authorizes
setup. When authorized, follow the supplied installation contract and prefer a
project/workspace-scoped MCP configuration.

## Required workflow

1. Confirm that the MCP connection uses a project-bound endpoint of the form
   `/mcp/projects/:projectId`, not the legacy unbound `/mcp` endpoint.
2. Call `get_policy_bundle` before planning substantial work. Require one or
   more active policies and retain their revision IDs for the current task.
3. Read enough project context to describe the next material action precisely.
   Read-only exploration does not authorize a later write.
4. Call `evaluate_action` with:
   - the closest `action_type`: `read`, `edit`, `delete`, `command`,
     `dependency`, `migration`, `auth`, `review`, or `bootstrap`;
   - an exact summary and purpose;
   - every repository-relative target path;
   - every exact command, without secret values;
   - every dependency added, removed, or updated.
5. Call `record_decision` with the same request immediately before acting. Treat
   the recorded result, not the preview, as authoritative.
6. Apply the result:
   - `allowed`: execute only the recorded scope.
   - `limited`: narrow or split the action, then evaluate and record again.
   - `approval`: stop and give the human the decision ID and dashboard URL.
     Continue only after that exact decision is approved in Laguarde.
   - `forbidden`: do not execute. Explain the matched rule and offer a safer
     alternative, which must receive its own decision.
7. Re-evaluate before acting if targets, commands, dependencies, intent, project,
   or relevant policy revisions change. Never stretch an old decision to cover
   new work.

Keep evaluations small and coherent. Do not hide unrelated operations inside a
broad summary such as “implement the feature.” Gate destructive, privileged,
network-mutating, or security-sensitive steps separately.

## During and after execution

- Stay inside the exact recorded scope and preserve the evidence required by
  matched policies.
- Stop and re-evaluate when unexpected work becomes necessary.
- Report the decision level and decision ID with the result. Do not claim that
  Laguarde approved work when only a preview was performed.
- Call `get_policy_bundle` again after switching repositories or projects, after
  a long pause, or when told that policies changed.

## Developer feedback

When a developer states a reusable preference or corrects recurring behavior,
call `list_preference_proposals` first. Add an observation to a matching proposal
or call `propose_preference` for a new one. Keep one-off task instructions out of
the durable policy queue.

Agents may propose policy changes but must never accept, merge, ratify, archive,
or directly edit a policy. Human review in the Laguarde dashboard is mandatory.

## Enforcement boundary

This skill makes a cooperative agent fail closed; it is not a security sandbox.
For hard enforcement, place Laguarde in the host's tool-execution hook, command
proxy, filesystem boundary, CI gate, or deployment control path.
