-- ============================================================================
-- Quick Todo — Backend Database Schema (PostgreSQL / Supabase-compatible)
-- ============================================================================
-- Design mirrors src/types/index.ts and src/db/schema.ts from the quick-todo
-- frontend as closely as possible, adding multi-user ownership + auth.
-- See ../docs/DATABASE_DESIGN.md for rationale and open questions.
--
-- Decisions locked in (v1 review):
--   - Auth: stateless JWT, no server-side session/refresh-token table.
--   - Recurring task deletion: orphan instances (recurring_parent_id -> NULL).
--   - Tags: normalized (tags + task_tags), not a flat array.
--   - Sync prep: soft-delete (deleted_at) on tasks and expenses.
-- ============================================================================

-- Case-insensitive email uniqueness without manually lower()-ing everywhere.
create extension if not exists citext;
create extension if not exists pgcrypto; -- for gen_random_uuid()

-- ── Enumerations (mirror the frontend's TS union types) ─────────────────────

create type priority as enum ('high', 'medium', 'low', 'none');
create type task_category as enum ('work', 'personal', 'project', 'routine');
create type task_status as enum ('todo', 'in-progress', 'done');
create type reminder_offset as enum ('none', 'at', '15', '30', '60', '1440');
create type recurring_pattern as enum ('none', 'daily', 'weekdays', 'weekly', 'monthly');
create type expense_category as enum
  ('grocery', 'rent', 'electricity', 'water', 'phone', 'entertainment', 'equipment', 'other');
create type currency_code as enum ('AED', 'USD', 'EUR', 'GBP', 'INR', 'SAR');
create type theme_pref as enum ('dark', 'light', 'system');

-- ── users ─────────────────────────────────────────────────────────────────

create table users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  email         citext not null unique,
  password_hash text not null,               -- argon2id/bcrypt hash, never plaintext
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table users is 'One row per signed-up user. No email/phone verification per product requirements.';

-- Auth is stateless JWT (access token only, no server-side session store).
-- Logging out / revoking a device is a client-side concern (discard the
-- token); there is deliberately no sessions/refresh-token table in v1.
-- If you later want forced-logout or refresh-token rotation, add a
-- `sessions` table back in without touching anything else here.

-- ── user_settings (1:1 with users) ───────────────────────────────────────
-- Mirrors AppSettings from the frontend. notificationPermission is
-- runtime/browser-only and intentionally NOT persisted here either.

create table user_settings (
  user_id                  uuid primary key references users(id) on delete cascade,
  theme                    theme_pref not null default 'dark',
  notifications_enabled    boolean not null default false,
  default_reminder_offset  reminder_offset not null default '30',
  default_priority         priority not null default 'none',
  show_completed           boolean not null default true,
  currency                 currency_code not null default 'AED',
  updated_at               timestamptz not null default now()
);

-- ── tags (normalized, per-user) ──────────────────────────────────────────
-- Each user has their own tag namespace. Names are stored lowercase,
-- no leading '#', matching the frontend's parseInput shortcut behavior.

create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null check (name = lower(name) and length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, name)
);

create index idx_tags_user_id on tags(user_id);

-- ── tasks ─────────────────────────────────────────────────────────────────

create table tasks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references users(id) on delete cascade,

  title                text not null check (length(trim(title)) > 0),
  description          text,

  priority             priority not null default 'none',
  category             task_category,
  status               task_status not null default 'todo',

  due_date             date,
  due_time             time,                 -- 24h HH:MM, paired with due_date
  reminder_offset      reminder_offset not null default 'none',
  recurring            recurring_pattern not null default 'none',

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,

  -- Soft delete: rows are never hard-deleted by the app so a future
  -- Dexie<->server sync can distinguish "deleted" from "never existed".
  -- Hard DELETE is still available for GDPR-style purges / account deletion.
  deleted_at           timestamptz,

  -- Self-reference: the recurring template a generated instance came from.
  -- ON DELETE SET NULL so deleting the template doesn't cascade-delete
  -- history — instances just become "orphaned" (no longer tracked back).
  recurring_parent_id  uuid references tasks(id) on delete set null
);

-- task_tags: many-to-many join between tasks and tags.
create table task_tags (
  task_id uuid not null references tasks(id) on delete cascade,
  tag_id  uuid not null references tags(id) on delete cascade,

  primary key (task_id, tag_id)
);

create index idx_task_tags_tag_id on task_tags(tag_id);

create index idx_tasks_user_id             on tasks(user_id);
create index idx_tasks_user_status         on tasks(user_id, status)   where deleted_at is null;
create index idx_tasks_user_priority       on tasks(user_id, priority) where deleted_at is null;
create index idx_tasks_user_category       on tasks(user_id, category) where deleted_at is null;
create index idx_tasks_user_due_date       on tasks(user_id, due_date) where deleted_at is null;
create index idx_tasks_user_created_at     on tasks(user_id, created_at);
create index idx_tasks_recurring_parent_id on tasks(recurring_parent_id);

-- ── expenses ─────────────────────────────────────────────────────────────

create table expenses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,

  title            text not null check (length(trim(title)) > 0),
  description      text,
  amount           numeric(12, 2) not null check (amount >= 0),

  category         expense_category not null,
  custom_category  text,                 -- only meaningful when category = 'other'

  date             date not null,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Soft delete, same rationale as tasks.deleted_at above.
  deleted_at       timestamptz,

  constraint chk_custom_category_only_for_other check (
    (category = 'other' and custom_category is not null and length(trim(custom_category)) > 0)
    or (category <> 'other')
  )
);

create index idx_expenses_user_id         on expenses(user_id);
create index idx_expenses_user_category   on expenses(user_id, category) where deleted_at is null;
create index idx_expenses_user_date       on expenses(user_id, date)     where deleted_at is null;
create index idx_expenses_user_created_at on expenses(user_id, created_at);

-- ── updated_at auto-touch trigger (applies to all mutable tables) ─────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

create trigger trg_user_settings_updated_at
  before update on user_settings
  for each row execute function set_updated_at();

create trigger trg_tags_updated_at
  before update on tags
  for each row execute function set_updated_at();

create trigger trg_tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();

create trigger trg_expenses_updated_at
  before update on expenses
  for each row execute function set_updated_at();
