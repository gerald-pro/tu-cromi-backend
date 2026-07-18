# AGENTS.md - Tu Cromi Backend

## Commands
```bash
npm run build           # Compile TypeScript to dist/ (nest build)
npm run start:dev       # Hot-reload dev server
npm run lint            # ESLint with autofix
npm run format          # Prettier format

# Tests
npm run test            # All unit tests (jest, config in package.json)
npm run test:e2e        # E2E tests (uses ./test/jest-e2e.json)
npx jest src/modules/auth/auth.service.spec.ts  # Single test file
npx jest --testPathPattern="auth.service"       # Test by pattern
```

## Architecture
- NestJS 11 monolith (single package, no monorepo)
- Entry point: `src/main.ts`
- Modules: `src/modules/` (auth, users, lines, favorites, search, transfers, reviews, issue-reports, update, offline)
- Shared: `src/common/` (guards, filters, decorators)
- Cache: `src/cache/` (transfer cache service)

## Database
- **SQLite** via `better-sqlite3` (TypeORM driver name: `'better-sqlite3'`)
- Single file at `data/tucromi.sqlite` — override with `DATABASE_FILE` env
- `synchronize: true` in development (auto-creates schema); disabled in production
- No migration tooling — schema changes are entity edits; the dev DB rebuilds on first boot
- Primary keys: UUID
- Column names: `snake_case` in DB, `camelCase` in code
- TypeORM-specific: use `simple-enum` and `simple-json` (not `enum`/`jsonb`); give explicit names to symmetric multi-column `@Index` decorators to avoid hash collisions

## Bootstrap / Seed
- No seed script — the dev DB starts empty; entities are auto-created on first boot
- `migrations/*.sql` are Postgres-era dead code (5 SQL files, no consumer). Safe to delete or keep as reference
- `src/database/_backup/compute-transfers.pg.ts.bak` — original Postgres/PostGIS transfer precomputation, kept as reference (excluded from TS build)

## Conventions
- Error messages: Spanish (e.g., `throw new NotFoundException('Usuario no encontrado')`)
- Error format: Consistent via `HttpExceptionFilter`
- Swagger: `@ApiTags`, `@ApiProperty` with examples on all DTOs

## Environment Variables
```
PORT=3000
NODE_ENV=development

# Database (SQLite)
DATABASE_FILE=./data/tucromi.sqlite

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Admin
ADMIN_KEY=your-admin-key
ADMIN_EMAILS=admin@example.com,admin2@example.com
```

## Endpoints
- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`

## Issue Reports
- Users report outdated routes/problems via `POST /issue-reports`
- `lineId` is optional to support non-line-specific reports
- Admin endpoints require `ADMIN_EMAILS` env var (comma-separated)
- Status flow: `PENDING → VERIFIED → FIXED` or `DISMISSED`
