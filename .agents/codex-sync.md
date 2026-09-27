# Codex plugin synchronization

The fork keeps authoring skills in their existing buckets. `npm run generate:codex` rebuilds `plugins/mattpocock-skills/` from the promoted Claude plugin allowlist. Do not edit that generated directory by hand. A content change advances the independent Codex plugin version; a higher canonical source package version raises its version floor. A no-op regeneration changes neither. `provenance.json` records the canonical source package version and source fingerprints. The sync PR records the exact upstream commit and its package version separately, because fork and upstream release versions can differ.

## What runs

- `Validate plugin` runs on every PR targeting `main`, every push to `main`, and manual dispatch. Its token has contents read permission, with no App credential. The required job name is exactly `Validate plugin`. There are deliberately no PR path filters that could leave a required check pending.
- `Sync upstream` runs at 04:23 UTC daily, on manual dispatch, and after relevant fork source changes on `main`. It only runs in `zxxz/mattpocock-skills` on `main`.
- Synchronization starts from fork `main` or the existing `codex/sync-upstream` branch, merges current fork `main`, then merges `mattpocock/skills` `main`. It preserves upstream ancestry and fork commits. It regenerates and validates the distribution before pushing the one sync branch and creating or updating its one PR. No force push or reset of `main` is used.
- The sync PR requests auto-merge with a merge commit. Strict required PR validation must pass for the current base before GitHub merges. A merge back to `main` can trigger one further no-op sync run, which creates no commit or PR.
- The existing Changesets release workflow continues to version the Claude plugin and also regenerates Codex through `sync-plugin-version.mjs`. On this fork it uses the same App installation, with only contents and pull requests permissions requested, so release PR checks run unattended.

For human-authored PRs, run `npm run generate:codex` and commit the generated changes alongside source edits. PR validation deliberately fails on stale generation. The push trigger repairs relevant source changes that reach `main`; it does not expose write credentials to PR code or automatically rewrite contributor branches.

## One-time repository setup

1. Create a GitHub App owned by the fork owner, for example at [New GitHub App](https://github.com/settings/apps/new). Use a distinct name, the fork URL as its homepage, disable webhooks, and leave user authorization/callback features unused. Restrict installation to the owning account.
2. Grant these repository permissions: **Contents: Read and write**, **Pull requests: Read and write**, and **Workflows: Read and write**. GitHub supplies metadata read permission. Workflows write is required because whole-upstream merges can change `.github/workflows/`. Do not grant administration, Actions, checks, organization, or account permissions.
3. Install the App on **only** `zxxz/mattpocock-skills`. Record its **Client ID**, generate one private key, and save these repository settings. Keep the key out of commits and chat:

   ```sh
   gh variable set CODEX_SYNC_APP_CLIENT_ID --repo zxxz/mattpocock-skills --body '<App Client ID>'
   gh secret set CODEX_SYNC_PRIVATE_KEY --repo zxxz/mattpocock-skills < /path/to/downloaded-app-private-key.pem
   ```

4. In repository Settings, allow merge commits and auto-merge. Protect `main` with a classic branch protection rule requiring **Validate plugin**, require the branch to be up to date before merging, apply the rule to administrators, and disallow force pushes and deletions. Do not give the App a bypass. Preserve any additional checks or review requirements already present. Additional required human reviews will intentionally prevent fully unattended merges.
5. Merge the implementation PR only after its real PR check passes. In Actions, enable fork workflows if GitHub has left them disabled. Run **Sync upstream** manually on `main` and inspect the result. Confirm that a real generated sync PR receives an automatic `pull_request` validation run and merges only after that check succeeds. A dispatched check is not a substitute for the required PR check.

The workflow checks auto-merge, merge-commit, and required-check settings before publishing a sync PR. An absent App credential fails with a setup instruction. There is no fallback token that silently requires manual approval for every bot PR. The App installation token is scoped to this repository and revoked when its job finishes. The fork release workflow also reports missing App setup rather than claiming unattended releases work.

The reason for the App is GitHub's event behavior: pushes made with `GITHUB_TOKEN` do not start ordinary downstream workflows, and PR runs produced with it can require manual approval. App installation tokens support unattended downstream validation. See [GitHub workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) and [App installation tokens](https://github.com/actions/create-github-app-token).

## Failure and recovery

Merge conflicts abort the local merge and fail the run before publication. Resolve the conflict on `codex/sync-upstream`, preserving both histories, push that branch, and run synchronization again. If the first sync has a conflict before the branch exists remotely, create that branch from fork `main`, merge upstream, resolve and commit the conflict, then push it. Never resolve by force-resetting fork `main` to upstream.

Failed generation or validation leaves `main` unchanged. Read the failed step, repair the source or sync branch, and rerun. A push race fails rather than force-updating another run's branch. The global concurrency group serializes sync runs. If protections change, restore the required check and auto-merge settings before retrying.

Schedules run from the default branch and are best effort. Public schedules can be disabled after 60 days without repository activity, and fork workflows can initially require activation. Re-enable **Sync upstream** in Actions and use **Run workflow** for immediate recovery. The off-hour schedule reduces contention but does not guarantee timing. See [GitHub scheduled workflow limits](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Focused local verification

```sh
npm ci
npm run check-plugin-version
npm run check:codex
npm run test:codex
node --test scripts/sync-upstream.test.mjs
claude plugin validate . --strict
claude plugin validate .claude-plugin/plugin.json
```

The sync simulation uses temporary Git repositories. It checks no-op history, upstream ancestry with fork changes, advancing an existing sync branch, conflict aborts, and rejection of dirty checkouts. It does not use repository credentials or mutate the real fork. These checks establish source behavior; active scheduled execution and installed Codex skill behavior require their separate live acceptance checks.

Claude Code 2.1.246 selects the marketplace for the repository-level strict command. Direct plugin validation additionally reports the existing root `CLAUDE.md` authoring file as a warning because Claude does not load it as plugin context. CI runs that direct check without `--strict`; the native Codex package does not rely on root `CLAUDE.md` for skill instructions.
