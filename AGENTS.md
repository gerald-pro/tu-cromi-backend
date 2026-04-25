# AGENTS.md - Tu Cromi Backend

## Build, Lint, and Test Commands

```bash
npm run build           # Compila TypeScript a dist/
npm run start          # Iniciar producción
npm run start:dev     # Iniciar con hot-reload
npm run lint          # ESLint con autofix
npm run format        # Prettier con write
npm run seed         # Importar líneas desde GeoJSON

# Tests
npm run test              # Ejecutar todos los tests
npm run test:watch       # Tests en watch mode
npm run test:cov        # Tests con coverage
npm run test:e2e        # Tests E2E
jest src/modules/auth/auth.service.spec.ts       # Test file específico
jest --testPathPattern="auth.service"         # Test por patrón
jest --testNamePattern="should login"         # Test por nombre
```

---

## Project Structure

```
src/
├── common/              # Shared code (decorators, guards, filters)
├── config/              # Configuration
├── modules/             # Feature modules
│   ├── auth/            # Authentication
│   ├── users/           # Users
│   ├── lines/           # Transit lines
│   └── favorites/       # User favorites
└── *.module.ts
```

---

## Naming Conventions

| Element       | Convention | Example                        |
| ------------- | ---------- | ------------------------------ |
| Files         | kebab-case | `auth.service.ts`              |
| Classes       | PascalCase | `AuthService`, `UserDto`       |
| Variables     | camelCase  | `userId`, `createdAt`          |
| Constants     | UPPER_CASE | `MAX_DISTANCE`, `JWT_SECRET`   |
| Enums         | PascalCase | `LineSense.Outbound`           |
| Database cols | snake_case | `created_at`, `parent_line_id` |

---

## Imports Order

1. Node.js built-ins (`node:...`)
2. External packages (`@nestjs/...`, `class-validator`)
3. Internal modules (`../users/users.service`)
4. Relative files (`./auth.service`)

---

## TypeScript Guidelines

- **Use explicit types** for parameters and return types
- **Avoid `any`** - use `unknown` when type is unknown
- **Use interfaces** for DTOs and data shapes
- **Use enums** for fixed sets of values

```typescript
// Good
async findById(id: string): Promise<User | null> {
  return this.userRepository.findOne({ where: { id } });
}
```

---

## NestJS Patterns

### Service Structure

```typescript
@Injectable()
export class ServiceNameService {
  constructor(
    @InjectRepository(Entity)
    private readonly repository: Repository<Entity>,
  ) {}

  async method(): Promise<ReturnType> {
    // Implementation
  }
}
```

### DTO with Validation

```typescript
export class CreateDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
```

### Controller

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }
}
```

---

## Error Handling

- Use NestJS built-in exceptions
- Messages in Spanish (project language)
- Return consistent error format via HttpExceptionFilter

```typescript
throw new NotFoundException('Usuario no encontrado');
throw new ConflictException('El email ya está registrado');
throw new UnauthorizedException('Credenciales inválidas');
```

---

## Database (TypeORM)

- UUID for primary keys
- `snake_case` for column names, `camelCase` for properties

```typescript
@Column({ name: 'created_at' })
createdAt: Date;

@Column({ name: 'geo_json', type: 'jsonb', nullable: true })
geoJson: object;
```

---

## Swagger Documentation

- Add `@ApiProperty` with examples to all DTOs
- Use `@ApiTags`, `@ApiOperation`, `@ApiResponse`

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200 })
  async login(@Body() dto: LoginDto) {}
}
```

---

## Environment Variables

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=tucromi
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

---

## Testing Guidelines

- Spec files next to source: `auth.service.ts` → `auth.service.spec.ts`
- Use `@nestjs/testing` for unit tests
- Mock with `jest.fn()`

```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should return user and token on valid credentials', async () => {
      // Test implementation
    });
  });
});
```

---

## PostgreSQL Note

PostgreSQL with TypeORM `synchronize: true` for development.
Create database manually: `CREATE DATABASE tucromi;`

Endpoints:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
