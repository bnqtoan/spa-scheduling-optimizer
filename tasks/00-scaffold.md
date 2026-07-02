# Task 00 — Scaffold (Phase 0, blocking)

**Model/effort:** Sonnet / medium
**Depends on:** none. Blocks: everything.

## Goal
Create the empty-but-runnable monorepo skeleton for **Spa Scheduling Optimizer**: a single Cloudflare Worker (Hono) serving `/api/*` + the Vite-built React SPA. No features yet — just the shell that later tasks fill in.

## Working dir
`/Users/bnqtoan/Documents/CCF/session-1-demo` (contains `CLAUDE.md`, `Spa Scheduling Optimizer.pdf`, `.DS_Store`, and this `tasks/` dir — do NOT delete the PDF or tasks/). The old `index.html` is already gone.

## Stack (exact — from PRD, non-negotiable)
React, Vite, TanStack Router, TanStack Query, Tailwind, shadcn/ui, FullCalendar (install but no calendar wiring yet). Backend: Cloudflare Workers, Hono, Drizzle ORM, Cloudflare D1, Zod. Node 22 / npm 10 / wrangler 4 confirmed present.

## Do
1. `git init` (Node `.gitignore`: node_modules, dist, .wrangler, .dev.vars, *.local).
2. Scaffold Vite + React + TypeScript in place. Client code under `src/client/`.
3. Tailwind configured; shadcn/ui initialized (components under `src/client/components/ui`). Set up a neutral base theme (spa palette comes in task 07 — just make sure Tailwind works).
4. Install & wire TanStack Router + TanStack Query providers in the client entry (a single placeholder route rendering "Spa Scheduling Optimizer" is enough).
5. Server under `src/server/`: Hono app with a `GET /api/health` → `{ ok: true }`. Worker entry (`src/server/index.ts`) routes `/api/*` to Hono and serves static SPA assets (Vite build output) for all other paths. Use the Workers **assets** binding for the SPA.
6. `wrangler.toml`: worker name `spa-scheduling-optimizer`, main = server entry, assets binding pointing at the client build dir, a **D1 binding** named `DB` (database name `spa-db`; leave `database_id` as a placeholder/local — do NOT create a remote DB here).
7. `drizzle.config.ts` pointing at `src/server/db/schema.ts` (file can be an empty `export {}` stub for now), dialect sqlite / d1, migrations out dir `migrations/`.
8. Install `drizzle-orm`, `drizzle-kit`, `zod`, `@fullcalendar/*` (core, react, resource-timeline, resource, interaction) as deps.
9. npm scripts in `package.json`:
   - `dev` — run client + worker for local dev (Vite + `wrangler dev`, or Vite with `/api` proxy to wrangler; pick one and document it in a one-line comment).
   - `build` — `vite build`.
   - `deploy` — `vite build && wrangler deploy`.
   - `db:generate` — `drizzle-kit generate`.
   - `db:migrate` — apply migrations to local D1 (`wrangler d1 migrations apply spa-db --local`).
   - `test` — vitest (install vitest; ok if zero tests for now).

## Constraints
- TypeScript throughout. Keep it minimal — NO business features, NO tables, NO screens beyond the placeholder.
- Do not scaffold auth, payments, or anything in the PRD Non-goals.
- Prefer official generators (`npm create vite@latest`, `npx shadcn@latest init`) over hand-rolling config.

## Verify before done
- `npm install` clean.
- `npm run build` succeeds (SPA builds).
- `npx wrangler dev` (or `npm run dev`) boots; `GET /api/health` returns `{ ok: true }`; root path serves the SPA placeholder.
- `npm test` runs (green / no tests).
- Report back the final directory tree (top 2 levels) and the exact `dev` command to use.

## Checklist
- [ ] git initialized + .gitignore
- [ ] Vite + React + TS scaffolded under src/client
- [ ] Tailwind working
- [ ] shadcn/ui initialized
- [ ] TanStack Router + Query wired, placeholder route renders
- [ ] Hono app + `GET /api/health` → {ok:true}
- [ ] Worker entry serves /api/* + SPA assets
- [ ] wrangler.toml with assets + D1 binding `DB` (spa-db)
- [ ] drizzle.config.ts + empty schema stub
- [ ] deps installed (drizzle, zod, fullcalendar, vitest)
- [ ] npm scripts: dev/build/deploy/db:generate/db:migrate/test
- [ ] `npm run build` passes
- [ ] worker boots, /api/health ok, SPA served
- [ ] reported dir tree + dev command
