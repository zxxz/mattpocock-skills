# The canonical install block

Change installation wording here first, then copy the marked blocks verbatim into `README.md`. Pages under `docs/` have no install commands because their site template renders the install widget.

This is the `zxxz/mattpocock-skills` fork. Its native Codex package is distributed by this repository marketplace, not an official OpenAI directory listing. The upstream Claude plugin remains available through Claude Code's official marketplace; that listing does not distribute this fork's Codex package.

## Codex: managed plugin from this fork

<canonical-block name="codex">

```bash
codex plugin marketplace add zxxz/mattpocock-skills --ref main
codex plugin add mattpocock-skills@mattpocock-fork
```

Start a new chat after installation. Use `$mattpocock-skills:setup-matt-pocock-skills` once per project. The marketplace ships exactly the promoted engineering and productivity skills. It is a repository marketplace, not an official directory listing.

To refresh an installed copy:

```bash
codex plugin marketplace upgrade mattpocock-fork
codex plugin add mattpocock-skills@mattpocock-fork
```

Start a new chat after updating. Automated repository synchronization and local plugin refresh are separate steps.

</canonical-block>

## Claude Code: upstream plugin

<canonical-block name="claude-code">

```bash
claude plugins install mattpocock-skills
```

Or, from inside a session:

```
/plugin install mattpocock-skills
```

This installs the upstream plugin from Claude Code's official marketplace. Its updates follow that marketplace's pinned revision, independently of this fork.

</canonical-block>

## Editable standalone skills

<canonical-block name="skills-sh-whole-set">

```bash
npx skills@latest add mattpocock/skills
```

Pick the skills you want, and which coding agents to install them on. **The installer lets you choose which skills to take: make sure `setup-matt-pocock-skills` is one of them.** This installs editable upstream sources, not this fork's generated Codex package.

</canonical-block>

Use upstream for standalone installation: recursive third-party discovery of this fork can also find its generated package copies. Maintainer scripts list only canonical `skills/` sources. Do not use `scripts/link-skills.sh` as a consumer installer.

<canonical-block name="skills-sh-one-skill">

```bash
npx skills@latest add mattpocock/skills --skill=<name>
```

```bash
npx skills@latest update <name>
```

</canonical-block>

## Pick one route per agent

Managed plugins and standalone skills are exclusive. Before switching, save any edits and remove or disable the old copy in that agent. Installing this fork beside an older Matt Pocock plugin from another marketplace also duplicates skills; choose one managed source. Do not remove unrelated skills or plugins.

## Maintainer notes

`.claude-plugin/marketplace.json` is the upstream-compatible fallback for direct Claude installation. `.agents/plugins/marketplace.json` is this fork's native Codex catalog. The generated package lives in `plugins/mattpocock-skills/`; canonical authoring remains in bucket folders under `skills/`.

See [the packaging decision](adr/0002-ship-as-a-claude-code-plugin.md), [compatibility audit](codex-compatibility.md), and [sync setup](codex-sync.md).
