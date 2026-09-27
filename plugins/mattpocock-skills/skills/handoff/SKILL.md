---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
---

## Codex execution

Resolve bundled references and templates relative to this installed SKILL.md. Resolve project files and generated artifacts relative to the user's workspace. Keep the plugin installation read-only.

Run this workflow only after the user explicitly selects it. Other skills may recommend it but cannot start it.

Write a handoff document summarising the current conversation so a fresh agent can continue the work. Save to the temporary directory of the user's OS - not the current workspace.

Include a "suggested skills" section in the document, naming the installed skills that fit the next session. Give the namespaced Codex skill labels for this plugin. Mark user-only skills as suggestions the human must explicitly select; for model-invoked skills, tell the next agent to read their installed SKILL.md and follow it. Do not carry plugin cache paths between machines.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

If the user passed arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.
