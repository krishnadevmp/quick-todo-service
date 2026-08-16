# quick-todo-service

Backend API for [Quick Todo](../quick-todo) — auth, tasks, and expenses,
scoped per user. Node.js + TypeScript + Express + Prisma + PostgreSQL.

See [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md) for the data model
and design decisions, and [`docs/API.md`](docs/API.md) for every endpoint.

**Manually testing an endpoint?** [`requests/api.http`](requests/api.http) has
a ready-to-run request for every route (install the free VS Code "REST
Client" extension, then click "Send Request" above any block — no Postman or
Swagger needed).

## Stack

- **Express** — routing/middleware, kept thin (no framework ceremony)
- **Prisma** — schema, migrations, and the query client ([`prisma/schema.prisma`](prisma/schema.prisma) is the source of truth for the DB)
- **PostgreSQL**
- **Zod** — request validation; also the single source of truth for the closed-value fields (priority, status, category, etc.) that mirror the frontend's TS union types — see the note at the top of `schema.prisma`
- **JWT (Bearer token)** — stateless auth, no server-side session store (see DATABASE_DESIGN.md's "Auth: what's not in the DB")
- **bcryptjs** — password hashing

## Setup

1. **Get a Postgres instance.** Either:
   ```bash
   docker compose up -d
   ```
   or point `DATABASE_URL` at an existing instance (e.g. Supabase).

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` — at minimum set a real `JWT_SECRET` for anything beyond local dev.

3. **Install and migrate:**
   ```bash
   npm install
   npm run prisma:migrate
   ```
   This creates the database schema from `prisma/schema.prisma` and generates the Prisma Client.

4. **Run the dev server:**
   ```bash
   npm run dev
   ```
   Listens on `http://localhost:4000` (or `PORT` from `.env`). `GET /health` is a DB-free liveness check.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start with hot-reload (tsx watch) |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run the compiled build |
| `npm run prisma:migrate` | Create/apply a migration in dev |
| `npm run prisma:deploy` | Apply existing migrations (CI/production) |
| `npm run prisma:studio` | Open Prisma's DB browser GUI |
| `npm run typecheck` | `tsc --noEmit` over `src` + `tests` |
| `npm test` | Run the unit test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with a coverage report |

## Testing

Unit tests (Vitest) live in `tests/unit/`, mirroring `src/`'s structure, and
never touch a real database — `tests/mocks/prisma.ts` is a hand-rolled mock
of the Prisma Client that each service test file swaps in for the real
`src/lib/prisma.ts` singleton via `vi.mock(...)`. That makes them fast (the
whole suite runs in a few seconds) and safe to run without Docker/Postgres —
which is also why they're the thing this scaffold could actually be verified
against in the environment it was built in.

**Scope, deliberately:**
- `src/services/**`, `src/schemas/**`, and `src/utils/**` (the actual business
  logic and validation) are unit-tested thoroughly — currently 149 tests,
  ~96% statement coverage on that layer.
- `src/routes/`, `src/controllers/`, `src/middleware/`, `src/app.ts`, and
  `src/lib/prisma.ts` are excluded from the coverage target (see
  `vitest.config.mts`). They're thin HTTP/DB-wiring glue that needs a real
  request/response cycle (or a real DB) to test meaningfully — that's an
  integration/e2e-test concern, not a unit-test one, and hasn't been built
  yet.

Going forward: for new features or bug fixes in the service/schema layer,
write the test first (red), then make it pass (green) — the mock Prisma
client in `tests/mocks/prisma.ts` already covers every model method used so
far; extend it if a new one is needed.

## Project layout

```
prisma/schema.prisma   Source of truth for the DB schema
src/
  server.ts            Entry point
  app.ts                Express app: middleware + route mounting
  routes/               URL -> controller wiring, one file per resource
  controllers/           HTTP-layer glue: parse req, call a service, shape res
  services/               Business logic + all Prisma queries
  schemas/                 Zod request validation (mirrors frontend's src/types/index.ts)
  middleware/               auth (JWT), validate (Zod), errorHandler
  lib/                      env, prisma client, jwt, password hashing
  utils/                    date <-> string helpers, recurring-date math, HttpError
```

## Status / not yet done

This is a scaffold: routes, validation, and DB queries are wired end-to-end
and typecheck cleanly, but **has not been run against a live Postgres
instance** in this environment (no Docker/Postgres available here) — run
`npm run prisma:migrate` and exercise the endpoints once you have a real
database before trusting it further. The `quick-todo` frontend still talks
to Dexie/IndexedDB directly; pointing it at this API is a separate step.

A few implementation notes worth knowing:
- `DELETE /api/tasks/:id`, `DELETE /api/tasks/completed`, and
  `DELETE /api/expenses/:id` all **soft-delete** (`deletedAt`), per the
  sync-prep decision in DATABASE_DESIGN.md. The Settings screen's
  "Permanently delete all done tasks" copy is describing the user-facing
  effect (gone from every view), not a literal hard `DELETE` — nothing purges
  the rows outright yet.
- Tags are returned alphabetically sorted (the `task_tags` join table has no
  inherent order), not in the insertion order the frontend currently keeps.
