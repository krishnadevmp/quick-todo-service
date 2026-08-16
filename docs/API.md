# API Reference

Base URL: `http://localhost:4000/api` (or wherever `PORT`/deployment puts it).

All routes except `POST /auth/signup` and `POST /auth/login` require:
```
Authorization: Bearer <token>
```
Every resource below is implicitly scoped to the authenticated user — there
is no way to read or write another user's data through this API.

Validation errors return `400` with `{ error, details }` (Zod's flattened
field errors). Not found -> `404 { error }`. Auth failures -> `401 { error }`.

## Auth

| Method & path | Body | Returns |
|---|---|---|
| `POST /auth/signup` | `{ name, email, password }` | `201 { user, token }` |
| `POST /auth/login` | `{ email, password }` | `200 { user, token }` |
| `GET /auth/me` | — | `200 { user }` |
| `PATCH /auth/password` | `{ currentPassword, newPassword }` | `204` |

`user` shape: `{ id, name, email, createdAt }` — `password`/`passwordHash` is
never returned.

`password` must be 8+ characters (checked in `src/schemas/auth.schema.ts`;
no other complexity rule is enforced yet — see DATABASE_DESIGN.md's open
questions).

## Tasks

All fields match `Task` in `quick-todo/src/types/index.ts` exactly (same
field names, same string-literal values for `priority`/`status`/etc.).

| Method & path | Notes |
|---|---|
| `GET /tasks?priority=&category=&tags=a,b&search=&sortBy=&sortDir=` | Filtered/sorted list. All query params optional; omit all for "get everything". `tags` is comma-separated; a task must have *every* listed tag. |
| `GET /tasks/today` | Non-done tasks due today, sorted by `createdAt` asc |
| `GET /tasks/upcoming?days=7` | `{ overdue: Task[], upcoming: Task[] }` |
| `GET /tasks/stats` | Dashboard aggregates — see below |
| `GET /tasks/:id` | |
| `POST /tasks` | Create. Body: `{ title, description?, priority?, category?, status?, dueDate?, dueTime?, reminderOffset?, recurring?, tags? }` — everything but `title` has the same default as `Task`'s type (`priority: 'none'`, `status: 'todo'`, etc). |
| `PATCH /tasks/:id` | Partial update, same shape as create |
| `PATCH /tasks/:id/series` | Series-wide edit (excludes `dueDate`/`status`/`completedAt` — each occurrence keeps its own). Applies to this task + every pending sibling in the recurring series. Returns `204`. |
| `POST /tasks/:id/complete` | Marks done; if recurring, spawns the next occurrence. Returns `{ task, nextTask? }` |
| `POST /tasks/:id/stop-recurring` | Sets `recurring: 'none'` on this task + pending siblings. `204` |
| `DELETE /tasks/:id` | **Soft delete** (`deletedAt`) |
| `DELETE /tasks/completed` | **Soft delete** every done task. Returns `{ count }` |
| `POST /tasks/import` | Bulk upsert — body is an array of task objects (optionally with `id`). Backs Settings -> "Import JSON". Returns `{ count }` |

`GET /tasks/stats` response:
```jsonc
{
  "total": 42, "completed": 10, "completedToday": 2,
  "dueToday": 3, "overdue": 1, "completionRate": 24,
  "priorityBreakdown": { "high": 5, "medium": 10, "low": 8, "none": 19 },
  "categoryBreakdown": { "work": 12, "personal": 8, "project": 4, "routine": 3, "uncategorized": 15 },
  "weeklyCompletions": [{ "date": "2026-08-10", "count": 2 }, /* ...7 days */],
  "streak": 3,
  "mostProductiveDay": "Tuesday"
}
```

## Expenses

| Method & path | Notes |
|---|---|
| `GET /expenses` | All, sorted by `date` desc then `createdAt` desc |
| `GET /expenses/stats` | See below |
| `GET /expenses/this-month-count` | `{ count }` — powers the sidebar/bottom-nav badge |
| `GET /expenses/:id` | |
| `POST /expenses` | `{ title, description?, amount, category, customCategory?, date }`. `customCategory` required iff `category === 'other'`. |
| `PATCH /expenses/:id` | Partial update, same shape |
| `DELETE /expenses/:id` | **Soft delete** (`deletedAt`) |

`GET /expenses/stats` response:
```jsonc
{
  "totalThisMonth": 1240.50, "totalToday": 32,
  "transactionsThisMonth": 18,
  "categoryTotals": [{ "label": "Grocery", "amount": 400 }, /* sorted desc */],
  "topCategory": { "label": "Grocery", "amount": 400 },
  "avgPerDay": 82.7
}
```

## Settings

One row per user, auto-created with defaults at signup.

| Method & path | Notes |
|---|---|
| `GET /settings` | `{ theme, notificationsEnabled, defaultReminderOffset, defaultPriority, showCompleted, currency }` |
| `PATCH /settings` | Partial update, same shape |

`notificationPermission` (browser `Notification.permission`) is intentionally
absent — it's runtime/browser state, never persisted server-side, matching
`settingsStore.ts`'s `partialize`.

## Not included (see DATABASE_DESIGN.md / README "Status")

- No push-notification endpoints — reminders are still client-side `setTimeout`.
- No `TaskRepository.bulkCreate()` equivalent beyond `/tasks/import` — it wasn't wired to any UI.
- No "export" endpoint — `GET /tasks` already returns everything; serializing it to a downloadable file stays a client-side concern, same as today.
