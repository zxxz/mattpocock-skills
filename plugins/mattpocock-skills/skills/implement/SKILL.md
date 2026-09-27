---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
---

## Codex execution

Resolve bundled references and templates relative to this installed SKILL.md. Resolve project files and generated artifacts relative to the user's workspace. Keep the plugin installation read-only.

Run this workflow only after the user explicitly selects it. Other skills may recommend it but cannot start it.

Implement the work described by the user in the spec or tickets.

Read and follow [tdd](../tdd/SKILL.md) where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, read and follow [code-review](../code-review/SKILL.md) to review the work.

Commit your work to the current branch.
