---
name: supabase-migration-review
description: Reviews Supabase schema, RLS, migration, auth, and data-access changes. Use when DB schema, migrations, policies, service role usage, or data services change.
---

# Supabase Migration Review

## Checklist

- A migration exists in `supabase/migrations` for every schema change.
- RLS policies remain safe and are not weakened accidentally.
- Service role usage is server-only and never reaches client-side code.
- TypeScript types and data services are updated for schema changes.
- Query and index impact is considered for new access patterns.
- Run visibility and participant access remain safe.
- No direct production DB workaround is used instead of migrations.
