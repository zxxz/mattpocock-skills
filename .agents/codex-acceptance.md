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

A second isolated profile installed from the pushed Git marketplace `zxxz/mattpocock-skills` at ref `codex/native-plugin-sync`. Marketplace upgrade and reinstall retained version `1.2.6`, exactly 25 plugin-owned skill identities and all 78 matching files. Local marketplace refresh also advanced the package through `1.2.3`, `1.2.5`, and `1.2.6`. These profiles do not replace the user's ordinary installation.

The source has 14 explicit-only and 11 model-invoked skills. Each generated policy is checked against its source, including negative tests that turn an automatic skill explicit-only or an explicit-only skill automatic. Claude-only frontmatter may be omitted from the Codex copy; canonical source flags and corresponding Codex policies remain unchanged.

| Probe | Observed behavior |
| --- | --- |
| Explicit `$mattpocock-skills:grill-me` | Loaded the cached sibling `grilling/SKILL.md`, then asked its first interview question |
| Unnamed domain-modeling request | Automatically selected and read cached `domain-modeling/SKILL.md`, then challenged customer/account/tenant boundaries |
| Plain `Reply READY` request | Returned READY without tools or a workflow |
| Explicit `$mattpocock-skills:ask-matt` | Recommended the namespaced `implement` workflow without executing it |
| Explicit wizard helper request | Read cached `wizard/SKILL.md` and `template.sh`, created a consumer-workspace script, preserved the library, passed `bash -n` |
| Wizard interactive execution | Displayed its confirmation step and exited successfully after confirmation in a PTY with `TERM=xterm-256color` |

A PTY reporting `TERM=dumb` caused the unchanged upstream wizard library's `tput clear` to exit before the first step. The helper therefore needs a working terminal type; syntax validation alone does not establish interactive portability. No helper-template bug fix is included in this packaging change.

## Boundaries

The CLI and its app-server discovery were tested. Desktop plugin-picker interaction, ChatGPT Work, cloud sessions, public-directory submission, real external trackers, and every subagent workflow were not exercised. A skill requiring a browser, authenticated tracker, human terminal or delegation still needs that capability. See the per-skill [compatibility audit](codex-compatibility.md).

The bundled plugin creator validation script initially rejected `disable-model-invocation: true` with `must be false`. This is a bundled preflight rule, not an observed public portal rejection. The generated Codex artifact omits that Claude-only field while retaining each byte-identical `agents/openai.yaml` policy and unchanged canonical sources.

## GitHub activation

- [Implementation PR #1](https://github.com/zxxz/mattpocock-skills/pull/1) received a real `pull_request` validation run. Its initial head `fbf600a82b9987845f0dafa41f07921556c4fdeb` passed [Validate plugin](https://github.com/zxxz/mattpocock-skills/actions/runs/36313610843/job/108604067390). The PR's current checks remain authoritative after further commits.
- Live repository readback confirmed auto-merge and merge commits enabled. Classic `main` protection requires `Validate plugin` from GitHub Actions on an up-to-date branch, includes administrators, and prohibits force pushes and deletions. No bypass was added.
- GitHub App `zxxz-mattpocock-skills-sync` (App ID `5095401`, installation `165411151`) is installed on only `zxxz/mattpocock-skills`. The repository has `CODEX_SYNC_APP_CLIENT_ID` and `CODEX_SYNC_PRIVATE_KEY` configured.
- An installation token returned exactly that one repository, contents/pull requests/workflows writes, and administration/metadata reads. The exact workflow protection query and predicate passed with that token. Temporary probe tokens were revoked.
- The first token probe exposed a real permission failure: GraphQL `branchProtectionRule` is forbidden without administration read. `refUpdateRule` omits strictness and ruleset endpoints omit classic protection, so the workflow now requests administration read explicitly. It does not request administration write; the release job retains its smaller token scope.

The implementation PR is still open at this report revision. The schedule cannot run until its workflow reaches `main`. Upstream still matches the fork's original base, so the first sync should be a no-op. A successful no-op cannot prove creation, validation, or auto-merge of a real sync PR; that final cycle remains to be observed on a source update. Local update, no-op and conflict simulations establish the corresponding Git behavior separately.
