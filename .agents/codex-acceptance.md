# Native Codex acceptance

Date: 2026-09-27. Source base: `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`. This report separates structural checks, installed runtime behavior, and GitHub activation. It is not a claim of universal compatibility.

## Local source checks

- `npm run test:codex`: generator and adapter checks cover the exact promoted selection, resources, negative unwanted-skill/drift cases, namespace uniqueness, source-to-package invocation policy parity, version increments, and no-op determinism.
- `node --test scripts/sync-upstream.test.mjs`: six temporary-repository simulations cover upstream updates, preserved fork history, an existing sync branch, already-merged branch no-op, merge conflicts, and dirty-checkout rejection.
- `npm run check-plugin-version` and `npm run check:codex` verify committed generated content without writes. `scripts/list-skills.sh` returns 38 canonical sources at this revision and no generated duplicates; `link-skills.sh` already limits discovery to canonical `skills/` and was not run.
- Portable manifest checked against the official Agent Plugins 1.0.0 JSON schema. Claude root strict validation passes. Direct Claude manifest validation passes with the upstream `CLAUDE.md` authoring-file warning described in the sync runbook.

## Isolated native runtime

Tested on macOS with `codex-cli 0.156.1`, through the native plugin CLI and app-server protocol. A temporary Codex home and disposable consumer directories were used. The 12 unrelated built-in/global skills visible in that test profile were disabled only in its temporary config. Before installation, its enabled skill count was zero. No standalone Matt Pocock installation was used. The user's ordinary plugins, skills, and config were preserved.

Native `codex plugin marketplace add` followed by `codex plugin add mattpocock-skills@mattpocock-fork` installed the package into the managed plugin cache. App-server `skills/list` returned exactly the 25 current promoted identities, all namespaced `mattpocock-skills:<skill>` and owned by `mattpocock-skills@mattpocock-fork`, with no loading errors. Every installed resource and invocation YAML was compared with the generated source.

The source has 14 explicit-only and 11 model-invoked skills. Each generated policy is checked against its source, including negative tests that turn an automatic skill explicit-only or an explicit-only skill automatic. Claude-only frontmatter may be omitted from the Codex copy; canonical source flags and corresponding Codex policies remain unchanged.

| Probe | Observed behavior |
| --- | --- |
| Explicit `$mattpocock-skills:grill-me` | Loaded the cached sibling `grilling/SKILL.md`, then asked its first interview question |
| Unnamed domain-modeling request | Automatically selected and read cached `domain-modeling/SKILL.md`, then challenged customer/account/tenant boundaries |
| Plain `Reply READY` request | Returned READY without tools or a workflow |
| Explicit wizard helper request | Read cached `wizard/SKILL.md` and `template.sh`, created a consumer-workspace script, preserved the library, passed `bash -n` |
| Wizard interactive execution | Displayed its confirmation step and exited successfully after confirmation in a PTY with `TERM=xterm-256color` |

A PTY reporting `TERM=dumb` caused the unchanged upstream wizard library's `tput clear` to exit before the first step. The helper therefore needs a working terminal type; syntax validation alone does not establish interactive portability. No helper-template bug fix is included in this packaging change.

## Boundaries

The CLI and its app-server discovery were tested. Desktop plugin-picker interaction, ChatGPT Work, cloud sessions, public-directory submission, real external trackers, and every subagent workflow were not exercised. A skill requiring a browser, authenticated tracker, human terminal or delegation still needs that capability. See the per-skill [compatibility audit](codex-compatibility.md).

The bundled plugin creator validation script initially rejected `disable-model-invocation: true` with `must be false`. This is a bundled preflight rule, not an observed public portal rejection. The generated Codex artifact omits that Claude-only field while retaining each byte-identical `agents/openai.yaml` policy and unchanged canonical sources.

## GitHub activation

Implementation PR checks, branch protection readback, Git marketplace installation, and App activation are recorded below after verification. Scheduled synchronization cannot be called operational until the workflow is on `main`, its App credential is installed, and a real App-created sync PR runs validation unattended.
