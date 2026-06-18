# AGENTS.md - Tu Cromi Backend

## Commands
```bash
npm run build              # nest build + postbuild copies src/data/ to dist/data/
npm run start:dev          # Hot-reload dev server
npm run lint               # ESLint with autofix
npm run format             # Prettier (singleQuote, trailingComma: all)
npx jest path/to/file.spec.ts  # Single test
npm run test               # All unit tests (jest, rootDir: src)
npm run test:e2e           # E2E (config: test/jest-e2e.json)
```

## Database scripts (run from `dist/`, so `npm run build` first)
```bash
npm run db:migrate         # Applies /migrations/*.sql in sorted order
npm run seed               # seed-lines (GeoJSON) then seed-reviews (mock)
npm run seed:force         # Same, but truncates existing data first
npm run compute:transfers  # Precompute line_transfers table
```

## Architecture
- NestJS 11 monolith (single package, no monorepo). Entry: `src/main.ts`
- Global prefix: `/api`. Global guards/filters: `JwtAuthGuard` (check `@Public()` decorator to bypass), `HttpExceptionFilter`, `ResponseInterceptor` (wraps in `{status,code,message,data}`)
- Modules: `src/modules/` — auth, users, lines, favorites, search, transfers, reviews, issue-reports
- Shared: `src/common/` — decorators (`@Public`, `@CurrentUser`), guards (`JwtAuthGuard`, `AdminGuard`), filters, interceptors, enums
- Database scripts: standalone TypeORM `DataSource` (not NestJS DI), in `src/database/`

## Database
- PostgreSQL + TypeORM. `synchronize: false` — schema managed via `/migrations/*.sql`
- PKs: UUID. Column names: `snake_case` in DB, `camelCase` in TS
- Manual setup: `CREATE DATABASE tucromi`. Seed order: lines → reviews (reviews need users+lines)

## Conventions
- Error messages: Spanish (`NotFoundException('Usuario no encontrado')`)
- Swagger: `@ApiTags`, `@ApiProperty` with examples on all DTOs
- ESLint relaxed: `@typescript-eslint/no-explicit-any: off`, `noImplicitAny: false`
- Prettier: `singleQuote: true`, `trailingComma: "all"`
- `.env` is gitignored but checked in (dev convenience). Copy `.env` for fresh clones.

## Environment Variables
```
DATABASE_HOST=localhost    # default; unset = localhost
DATABASE_PORT=5432
DATABASE_NAME=tucromi
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=false         # 'true' for Aiven (rejectUnauthorized: false)
JWT_SECRET=dev-secret-key-not-for-production
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
ADMIN_EMAILS=admin@example.com,admin2@example.com
```

## Endpoints
- API: `http://localhost:3000/api` | Swagger: `http://localhost:3000/api/docs`
- Public routes (use `@Public()` decorator): `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/lines`, `GET /api/lines/:id`, `POST /api/search`
- Protected: `GET/POST/DELETE /api/favorites`, `GET /api/users/me`
- Admin (requires email in `ADMIN_EMAILS`): issue-reports status transitions, transfers cache management

## Issue Reports
- `POST /api/issue-reports` — `lineId` optional. Status flow: `PENDING → VERIFIED → FIXED | DISMISSED`
