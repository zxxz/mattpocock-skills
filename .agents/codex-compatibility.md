# Codex compatibility audit

Audit date: 2026-09-27. The canonical authoring tree and Claude workflows stay under `skills/`. `scripts/codex-compatibility.mjs` adapts Markdown while the generator copies the promoted allowlist into the flat Codex distribution. Generated files are not a second authoring source.

## Invocation contract

At this audit, the Claude allowlist contains 25 skills: 14 user-only and 11 model-invoked. The generator derives the selection each time and cross-checks it against the promoted buckets. The count is evidence for this revision, not a permanent constraint.

Every packaged `agents/openai.yaml` is copied byte for byte from its canonical source. User-only skills keep `policy.allow_implicit_invocation: false`; model-invoked skills keep automatic matching through their existing descriptions and default invocation policy. Canonical user-only `SKILL.md` files retain `disable-model-invocation: true` for Claude. The generated Codex files omit only that Claude-only frontmatter field, preserving the rest of the frontmatter and the same invocation behavior through Codex's YAML policy. Explicit selection uses the plugin namespace, for example `$mattpocock-skills:grill-me`.

This follows the documented [explicit and implicit Codex skill behavior](https://learn.chatgpt.com/docs/build-skills). Policy controls invocation, not the visibility of every metadata list. A router may inspect a user-only skill to explain it; it must leave execution to an explicit user selection.

## Audit by skill

The files column counts `SKILL.md`, `agents/openai.yaml`, and every additional resource. All current skill directories and both helper scripts were inspected. Static source coverage does not establish successful model behavior on every surface.

| Skill | Invocation | Files | Codex behavior and dependencies |
| --- | --- | --- | --- |
| ask-matt | User only | 3 | Namespaced recommendations, installed sibling inventory, read-only inspection, user-owned context actions, bundled phase-boundary reference |
| diagnosing-bugs | Automatic or user | 3 | Workspace feedback loop; bundled HITL Bash template copied before editing; human terminal required for its interactive branch |
| grill-with-docs | User only | 2 | Reads and follows both packaged grilling and domain-modeling; project glossary and ADRs remain in the workspace |
| triage | User only | 4 | Packaged grilling and domain-modeling; bundled brief and scope references; configured tracker and credentials remain external |
| improve-codebase-architecture | User only | 3 | Packaged codebase-design, grilling and domain-modeling; available Codex subagent tools; browser and CDN access for report |
| setup-matt-pocock-skills | User only | 7 | Codex AGENTS.md entry point, preserved existing instructions and review gate; all five tracker/domain templates bundled |
| tdd | Automatic or user | 4 | Packaged codebase-design reference and local tests/mocking references; existing seam confirmation retained |
| to-spec | User only | 2 | Configured project tracker; setup remains a recommendation requiring user selection |
| to-tickets | User only | 2 | Configured project tracker and existing approval of ticket breakdown; local output remains workspace-relative |
| wayfinder | User only | 2 | Packaged research, prototype, grilling and domain-modeling; dynamic Notes must honor each named skill's invocation policy |
| implement | User only | 2 | Bare TDD/review labels become explicit reads of their packaged SKILL.md files; commit workflow retained |
| prototype | Automatic or user | 4 | Bundled LOGIC/UI references; route and branch paths unchanged; project task runner and browser remain external |
| research | Automatic or user | 2 | One background researcher; an already-delegated researcher performs its task directly; cited workspace file required |
| domain-modeling | Automatic or user | 4 | Bundled ADR/glossary templates; sample context-map links are consumer-workspace examples |
| codebase-design | Automatic or user | 4 | Bundled deepening/design-it-twice references; parallel designs require actual subagent capability |
| code-review | Automatic or user | 2 | Available Codex subagent tools for the independent review axes; Git and spec source remain project prerequisites |
| resolving-merge-conflicts | Automatic or user | 2 | Existing Git intent-based resolution and finish workflow unchanged |
| wizard | Automatic or user | 3 | Bundled Bash library unchanged; workspace copy, human terminal, authenticated gh for GitHub writes |
| grill-me | User only | 2 | Reads and follows packaged grilling; retains the user-only front door |
| grilling | Automatic or user | 2 | Interview rounds and human decision gate retained; fact-finding delegation uses available tools |
| handoff | User only | 2 | Suggested skills retain explicit-only policy; no machine-specific plugin cache paths carried to another host |
| teach | User only | 6 | Four bundled format references; lessons, assets and learning records remain in the teaching workspace |
| to-questionnaire | User only | 2 | Questionnaire written into the workspace; no delivery to its recipient is added |
| wait-what | User only | 2 | Existing simplification and workspace glossary behavior unchanged |
| writing-for-agents | Automatic or user | 3 | Bundled skill-mechanics reference includes Codex policy pairing and avoids assuming every client hides user-only metadata |

## Adaptations and invariants

- Explicit Claude Skill tool calls become file reads of a named, packaged sibling's `SKILL.md`. Each named dependency must exist in the promoted inventory and allow model invocation. Unknown or user-only dependencies fail generation. An unrecognized remaining Skill tool instruction also fails generation for review.
- The `implement` skill's two bare operative labels are handled specifically. Other slash skill labels become namespaced Codex labels, including the human-facing router. URLs, filesystem paths and prototype routes stay unchanged.
- The dynamic Notes path in `wayfinder` checks the installed skill's policy before execution. A ticket body cannot grant permission to invoke a user-only workflow or imply an external skill is installed.
- Setup prefers `AGENTS.md`. When only `CLAUDE.md` exists, its draft adds `AGENTS.md` pointing to those existing instructions and carrying the setup block. The existing draft-and-confirm step remains. No canonical Claude source is modified.
- Subagent workflows use whichever delegation tools the current Codex session exposes. Missing capability is reported before the dependent step. Sequential inline work is not reported as parallel independent review. The research recursion guard is an instruction, not a runtime-enforced depth limit.
- Bundled references and templates resolve from the installed skill directory. Output files, project configuration and course assets resolve from the consumer workspace. The installation stays read-only. Helper scripts, assets and invocation YAML are copied without content adaptation.
- The package does not install Git, Bash, gh, glab, browser tools, a tracker, a search provider, a CDN, credentials or external skills. Their use stays conditional on the skill's actual task and environment. No hooks, connectors or standalone-skill fallback are added to pretend those prerequisites exist.

## Verification boundary

Run `node --test scripts/codex-compatibility.test.mjs` for the focused adapter checks: real packaged sibling dispatch, rejection of user-only or unknown dependencies, rejection of unhandled Claude tool wording, namespaced labels, and unchanged routes and non-Markdown resources. Full generation validates the actual promoted sources, rather than only these small examples.

The native-client installation and model-driven acceptance report records tested versions and surfaces separately. An accepted manifest does not prove invocation, tool availability, interactive terminal behavior or cross-skill execution. The bundled `validate_plugin.py` compatibility preflight rejects `disable-model-invocation` when present with a value other than false (lines 469-474 in the inspected version). That local check motivates omitting the Claude-only syntax from generated files. The public submission portal was not tested; this is not evidence of a portal rejection or acceptance.

Relevant official guidance: [portable plugin packaging](https://developers.openai.com/plugins/build/plugins), [skill authoring and invocation](https://learn.chatgpt.com/docs/build-skills), and [Claude plugin conversion](https://developers.openai.com/plugins/guides/submit-claude-plugin).
