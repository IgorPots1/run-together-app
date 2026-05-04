---
name: safe-implementation
description: Implements small requested changes with minimal diff. Use for focused bug fixes, small UI tweaks, and narrow feature work in this MVP.
---

# Safe Implementation

## Instructions

- Implement only the requested task.
- Keep the diff minimal.
- Do not make unrelated refactors.
- Preserve existing behavior unless the user explicitly requests a change.
- Keep MVP scope simple and easy to migrate later.
- Keep user-facing UI in Russian unless explicitly requested otherwise.
- Run `npm run lint` and `npm run build` when runtime code changes unless explicitly skipped.
- Return changed files, verification results, and a concise commit message.
