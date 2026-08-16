# Quick Todo — Backend Database Design (v1)

Status: **decisions locked in, ready to build migrations from**.
Engine: **PostgreSQL** (matches REQUIREMENTS.md OQ-1: "Supabase preferred, SQL").
Full DDL: [`db/schema.sql`](../db/schema.sql)

## Why this shape

The frontend (`quick-todo`) already stores `Task`, `Expense`, and `AppSettings`
in Dexie/IndexedDB, one flat store per entity, no `userId` yet. This design:

1. Mirrors those three entities field-for-field so the sync/adapter layer you
   already planned (repository pattern, REQUIREMENTS.md §3.2) has minimal
   translation to do.
2. Adds `users` and a `user_id` foreign key everywhere, since REQUIREMENTS.md
   §9 already anticipated this ("all tasks have a `userId` field, set to
   `local` in MVP — ready for multi-user cloud sync").
3. Adds nothing speculative beyond that — no orgs, no sharing, no roles. You
   said solo/personal use; the schema reflects that.

## Decisions (validated with you)

| Question | Decision |
|---|---|
| Auth sessions | **Stateless JWT.** No `sessions`/refresh-token table. Logout/revoke is a client-side concern (discard the token). Can be added back later without touching other tables. |
| Recurring task deletion | **Orphan instances.** `recurring_parent_id` → `NULL` on template delete; generated instances (including completed ones) stay in history. |
| Tags | **Normalized.** `tags` (per-user namespace) + `task_tags` join table, not a flat array — enables renaming a tag everywhere and tag-usage queries later. |
| Sync prep | **Soft delete now.** `deleted_at` on `tasks` and `expenses` so a future Dexie↔server sync can tell "deleted" apart from "never existed". Partial indexes (`WHERE deleted_at IS NULL`) keep normal queries fast. |

## Entity-relationship diagram

```mermaid
erDiagram
    users ||--o{ tasks : owns
    users ||--o{ expenses : owns
    users ||--o{ tags : owns
    users ||--|| user_settings : has
    tasks |o--o{ tasks : "recurring_parent_id"
    tasks ||--o{ task_tags : tagged_with
    tags  ||--o{ task_tags : applied_to

    users {
        uuid id PK
        text name
        citext email UK
        text password_hash
        timestamptz created_at
        timestamptz updated_at
    }

    tasks {
        uuid id PK
        uuid user_id FK
        text title
        text description
        priority priority
        task_category category
        task_status status
        date due_date
        time due_time
        reminder_offset reminder_offset
        recurring_pattern recurring
        uuid recurring_parent_id FK
        timestamptz created_at
        timestamptz updated_at
        timestamptz completed_at
        timestamptz deleted_at
    }

    tags {
        uuid id PK
        uuid user_id FK
        text name
        timestamptz created_at
        timestamptz updated_at
    }

    task_tags {
        uuid task_id PK_FK
        uuid tag_id PK_FK
    }

    expenses {
        uuid id PK
        uuid user_id FK
        text title
        text description
        numeric amount
        expense_category category
        text custom_category
        date date
        timestamptz created_at
        timestamptz updated_at
        timestamptz deleted_at
    }

    user_settings {
        uuid user_id PK_FK
        theme_pref theme
        boolean notifications_enabled
        reminder_offset default_reminder_offset
        priority default_priority
        boolean show_completed
        currency_code currency
    }
```

## Table-by-table notes

### `users`
- **Signup fields**: `name`, `email`, `password_hash` only — no phone, no
  verification flags, matching what you asked for.
- `email` is `citext` so `Foo@x.com` and `foo@x.com` collide as the same
  account without you writing `lower()` everywhere.
- Store a password **hash** (argon2id or bcrypt at the app layer), never the
  raw password. Enforce minimum length/strength in the API, not the DB.

### `tasks`
- Field-for-field match to `Task` in [`src/types/index.ts`](../../quick-todo/src/types/index.ts),
  minus `tags` (moved to `tags`/`task_tags`, see below).
- `recurring_parent_id` self-references `tasks`, `ON DELETE SET NULL`.
- `due_date`/`due_time` stay as plain `date`/`time` (no timezone), matching
  the frontend's local-date-string approach (`YYYY-MM-DD`, `HH:MM`) — these
  are wall-clock values the client interprets in its own local time, not
  absolute instants.
- `deleted_at`: the app should `UPDATE ... SET deleted_at = now()` instead of
  `DELETE` for normal user-facing deletes, and filter every read query with
  `WHERE deleted_at IS NULL`. A real `DELETE` is still available for account
  deletion / GDPR purges (cascades via `ON DELETE CASCADE` on `user_id`).

### `tags` / `task_tags`
- `tags.name` is lowercase, no `#` prefix — same normalization the frontend
  already does when parsing `#tag` shortcuts.
- Scoped per-user (`unique(user_id, name)`), so two users can each have a
  `#work` tag without collision.
- `task_tags` is a plain join table (`task_id`, `tag_id` composite PK).

### `expenses`
- Field-for-field match to `Expense`. A `check` constraint enforces the same
  invariant the UI enforces: `custom_category` is required when (and only
  when) `category = 'other'`.
- `amount numeric(12,2)` with a `>= 0` check — exact decimal, no float
  rounding issues for money.
- Same `deleted_at` soft-delete treatment as `tasks`.

### `user_settings`
- One row per user (`user_id` is both PK and FK), created at signup with
  `DEFAULT_SETTINGS` values (matches `src/types/index.ts`'s
  `DEFAULT_SETTINGS`).
- `notificationPermission` (browser `Notification.permission` state) is
  **not** persisted here either — it's runtime/browser-only in the frontend
  too (`settingsStore.ts` explicitly excludes it from `partialize`).

## Auth: what's *not* in the DB

Login is stateless JWT — the DB only stores `password_hash`. The API layer
is responsible for: hashing on signup (argon2id/bcrypt), verifying on login,
signing/verifying the JWT, and deciding token lifetime. There's no way to
force-revoke a specific device's token before it expires; if that becomes a
requirement later, reintroduce a `sessions` table without touching anything
else in this schema.

## Push notifications: not modeled

The current scheduler (`notificationScheduler.ts`) is 100% client-side
`setTimeout` + the local `Notification` API — nothing to persist server-side.
If a later phase wants the *server* to push notifications (so reminders fire
even when the tab/app isn't open), that needs a `push_subscriptions` table
(endpoint + keys per device) — deliberately left out of this pass.

## Still open (not blocking, revisit when relevant)

- **Password rules** — minimum length/complexity is an API-layer decision,
  not enforced by the DB beyond `not null`.
- **Conflict resolution** — `updated_at` on every row supports a future
  last-write-wins sync against the Dexie client, but no merge strategy is
  designed yet. Fine to defer until the sync layer itself is being built.
