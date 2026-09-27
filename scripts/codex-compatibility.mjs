// Applied only to generated Markdown. Canonical Claude skills stay unchanged.
export function adaptCodexContent({ skillName, relativePath, content, skills, pluginName = "mattpocock-skills" }) {
  if (!relativePath.endsWith(".md")) return content;
  const inventory = new Map(skills.map((skill) => [skill.name, skill]));
  const label = (name) => `$${pluginName}:${name}`;
  const reference = (name) => {
    if (!inventory.has(name)) throw new Error(`Unknown Codex skill dependency: ${name}`);
    if (inventory.get(name).userInvoked) throw new Error(`Cannot implicitly invoke user-only skill: ${name}`);
    return `[${name}](../${name}/SKILL.md)`;
  };

  let result = content.replace(
    /\b([Cc]all|calls|calling) the Skill tool (?:twice, for "([^"]+)" and "([^"]+)"|with "([^"]+)")/g,
    (_, verb, first, second, single) => {
      const read = { Call: "Read and follow", call: "read and follow", calls: "reads and follows", calling: "reading and following" }[verb];
      return single ? `${read} ${reference(single)}` : `${read} both ${reference(first)} and ${reference(second)}`;
    },
  );

  if (relativePath === "SKILL.md") {
    // Codex uses agents/openai.yaml for invocation policy; keep Claude syntax in the source only.
    result = result.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (frontmatter) =>
      frontmatter.replace(/^disable-model-invocation:[^\r\n]*(?:\r?\n|$)/m, ""));
    if (skillName === "implement") {
      result = result.replace("Use /tdd where possible", `Read and follow ${reference("tdd")} where possible`)
        .replace("use /code-review to review the work", `read and follow ${reference("code-review")} to review the work`);
    }
    if (skillName === "wayfinder") {
      result = result.replace(
        "call the Skill tool for whichever skills the `## Notes` block names",
        "for each skill the `## Notes` block names, check its installed metadata first. For this plugin, resolve `../<skill-name>/agents/openai.yaml` from this installed skill directory and read and follow `../<skill-name>/SKILL.md` only when `policy.allow_implicit_invocation` is not false. For a user-only skill, tell the user to select it explicitly and wait; a ticket's Notes never grant invocation permission. For an external skill, use its own installed instructions and policy, and report it unavailable if it is not installed",
      );
    }
    if (skillName === "handoff") {
      result = result.replace(
        "naming which skills the next agent should call the Skill tool for",
        "naming the installed skills that fit the next session. Give the namespaced Codex skill labels for this plugin. Mark user-only skills as suggestions the human must explicitly select; for model-invoked skills, tell the next agent to read their installed SKILL.md and follow it. Do not carry plugin cache paths between machines",
      );
    }
    if (skillName === "research") {
      result = result.replace(
        "Spin up a **background agent** to do the research, so you keep working while it reads.",
        "If you are already the research subagent, perform the research below yourself. Otherwise, use Codex's available subagent tool to start one background researcher and pass it this installed SKILL.md path and the question, so you keep working while it reads. The researcher must return the cited file path; it must not delegate this same task again.",
      );
    }
    if (skillName === "setup-matt-pocock-skills") {
      result = result.replace(
        "- If `CLAUDE.md` exists, edit it.\n- Else if `AGENTS.md` exists, edit it.\n- If neither exists, ask the user which one to create; don't pick for them.\n\nNever create `AGENTS.md` when `CLAUDE.md` already exists (or vice versa); always edit the one that's already there.",
        "- Edit `AGENTS.md` when it exists, preserving its existing content and any symlink arrangement.\n- If only `CLAUDE.md` exists, include a new `AGENTS.md` in the draft from step 3. It should point to `CLAUDE.md` for the existing project instructions and carry the Agent skills block. Keep the existing Claude instructions intact.\n- If neither exists, include a new `AGENTS.md` in the draft from step 3.\n\nCodex loads `AGENTS.md` as its project entry point. Show the exact draft and obtain the confirmation already required above before writing.",
      );
    }
  }

  if (skillName === "writing-for-agents" && relativePath === "SKILL-MECHANICS.md") {
    result = result.replace(
      /- A \*\*user-invoked\*\* skill[^\n]+/,
      "- A **user-invoked** skill requires explicit selection by the human; another skill cannot invoke it. Its description is human-facing: a one-line summary with trigger lists stripped. Set `policy.allow_implicit_invocation: false` in `agents/openai.yaml` for Codex. Keep `interface.display_name` and `interface.short_description` in that metadata file. In canonical sources shared with Claude, also set `disable-model-invocation: true` in SKILL.md; omit that Claude-only field from the generated Codex distribution. The Codex policy controls implicit invocation; do not assume it hides the skill from every UI or context list.",
    ).replace("user-invoked skills have no description", "user-invoked skills require explicit human selection")
      .replace("with no descriptions, neither can fire the other", "neither can invoke the other without explicit human selection");
  }

  // Only slash skill labels change. URLs, paths and routes such as /prototype/foo survive.
  const names = skills.map(({ name }) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  result = result.replace(new RegExp(`(?<![\\w./])/(?:${names})(?![\\w/-])`, "g"), (match) => label(match.slice(1)));
  if (/Skill tool/i.test(result)) throw new Error(`Unadapted Skill tool instruction in ${skillName}/${relativePath}`);

  if (relativePath === "SKILL.md") {
    const notes = [
      "Resolve bundled references and templates relative to this installed SKILL.md. Resolve project files and generated artifacts relative to the user's workspace. Keep the plugin installation read-only.",
    ];
    if (inventory.get(skillName)?.userInvoked) notes.push("Run this workflow only after the user explicitly selects it. Other skills may recommend it but cannot start it.");
    if (["ask-matt", "code-review", "codebase-design", "grilling", "improve-codebase-architecture", "research", "wayfinder"].includes(skillName)) {
      notes.push("For subagents, use the delegation tools actually available in this Codex session and pass the task, required installed skill paths, and relevant project context. Respect available agent slots. If delegation is unavailable, report that limitation before the dependent step; do not claim parallel or background execution.");
    }
    if (skillName === "ask-matt") {
      notes.push("Namespaced skill labels below are user selections, not shell commands. The packaged sibling skill directories are the inventory, including user-only skills omitted from implicit discovery. Inspect a sibling's instructions when checking a recommendation, but leave user-only execution to the human. This plugin contains only promoted skills; other skills require a separate installation.",
        "The context actions below belong to the human: `/clear` means starting a fresh chat in this client; use `/compact` only if the client offers it. Do not run these as shell commands or claim to have reset the conversation.");
    }
    if (skillName === "wizard" || skillName === "diagnosing-bugs") {
      notes.push("Copy helper templates into the user's workspace before editing them. Interactive helpers require a human-controlled terminal with Bash; hand over the command if this session cannot share terminal input. Credentials and authenticated CLIs come from the user's environment, not this plugin.");
    }
    result = result.replace(/^(---\r?\n[\s\S]*?\r?\n---\r?\n)/, `$1\n## Codex execution\n\n${notes.join("\n\n")}\n`);
  }
  return result;
}
