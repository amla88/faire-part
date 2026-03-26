Supabase backup notes (before RLS/function cleanup)

- Project: `hgphrkeajnxnymaqndrf` (Faire-Part)
- Backup type: logical snapshot via MCP `execute_sql`
- Timestamp: 2026-03-26

Data snapshot output file:

- `C:\Users\lariv\.cursor\projects\d-faire-part\agent-tools\01477e13-5beb-4c8f-b6d1-bea34f80c89f.txt`

The snapshot contains JSON data dumps for:

- `public.familles`
- `public.personnes`
- `public.avatars`
- `public.musiques`
- `public.audit_log`
- `public.app_secrets`

Additional pre-change metadata was captured via MCP queries:

- `pg_policies` for schema `public`
- `pg_indexes` for app tables
- `pg_get_functiondef` for key RPC/functions:
  - `get_famille_by_token`
  - `get_personnes_by_famille`
  - `get_avatar_for_token`
  - `upsert_avatar_for_token`
  - `insert_famille`
  - `touch_updated_at`
  - `record_rsvp`
  - `upsert_rsvp`

