# AGENTS.md - Tu Cromi Backend

## Commands
```bash
npm run build           # Compile TypeScript to dist/ (nest build)
npm run start:dev       # Hot-reload dev server
npm run seed            # Import lines from GeoJSON + generate mock reviews
npm run db:migrate      # Run SQL migrations from /migrations/*.sql
npm run compute:transfers  # Precompute transfers
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
- Modules: `src/modules/` (auth, users, lines, favorites)
- Shared: `src/common/` (guards, filters, decorators)
- CLI: `src/cli.ts` (nest-commander for seed/compute-transfers)

## Database
- PostgreSQL with TypeORM
- `synchronize: true` for `NODE_ENV=development` (auto-schema; `db:migrate` for explicit migrations)
- Primary keys: UUID
- Column names: `snake_case` in DB, `camelCase` in code
- Manual setup: `CREATE DATABASE tucromi;`

## Conventions
- Error messages: Spanish (e.g., `throw new NotFoundException('Usuario no encontrado')`)
- Error format: Consistent via `HttpExceptionFilter`
- Swagger: `@ApiTags`, `@ApiProperty` with examples on all DTOs

## Environment Variables
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=tucromi
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
DATABASE_SSL=true         # Set to 'true' when connecting to Aiven
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
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
