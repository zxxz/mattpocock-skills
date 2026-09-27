---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

## Codex execution

Resolve bundled references and templates relative to this installed SKILL.md. Resolve project files and generated artifacts relative to the user's workspace. Keep the plugin installation read-only.

For subagents, use the delegation tools actually available in this Codex session and pass the task, required installed skill paths, and relevant project context. Respect available agent slots. If delegation is unavailable, report that limitation before the dependent step; do not claim parallel or background execution.

If you are already the research subagent, perform the research below yourself. Otherwise, use Codex's available subagent tool to start one background researcher and pass it this installed SKILL.md path and the question, so you keep working while it reads. The researcher must return the cited file path; it must not delegate this same task again.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them. Follow every claim back to the source that owns it.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Save it where the repo already keeps such notes; match the existing convention, and if there is none, put it somewhere sensible and say where.
