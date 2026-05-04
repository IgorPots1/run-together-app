---
name: ask-audit
description: Performs audit-only investigation before implementation. Use when the user asks to audit, investigate, review a risky area, or start with root-cause analysis.
---

# Ask Audit

## Instructions

- Do not change code, configuration, database schema, or runtime behavior.
- Inspect only the relevant files and current behavior needed for the question.
- Find the likely root cause and explain the evidence.
- List affected files.
- Propose the smallest safe fix.
- Flag DB, RLS, auth, mobile, geo, map, join-flow, and notification risks when relevant.
- Stop before implementation and ask for approval or next direction.
