/**
 * Seed data for local development / demos.
 *
 * The actual seed statements live in `seed.sql` (plain SQL, idempotent
 * delete-then-insert) and are applied directly against local D1 via:
 *
 *   npm run db:seed
 *   # -> wrangler d1 execute spa-db --local --file=src/server/db/seed.sql
 *
 * Why a .sql file instead of driving drizzle at runtime: `wrangler d1
 * execute --file` is the most reliable way to seed local D1 from npm
 * scripts (no need to boot a worker or fake a D1Database binding outside
 * the Workers runtime). This file exists so the seed data has a documented,
 * typed home for anyone reaching for `db/seed.ts`, and so tests/tools can
 * import `SEED_SQL_PATH` instead of hardcoding the path.
 */

export const SEED_SQL_PATH = 'src/server/db/seed.sql'
