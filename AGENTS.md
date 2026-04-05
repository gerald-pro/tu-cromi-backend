# AGENTS.md - Tu Cromi Backend

## Build, Lint, and Test Commands

### Build

```bash
npm run build           # Compila TypeScript a dist/
nest build              # Alias alternativo
```

### Development

```bash
npm run start           # Iniciar producción
npm run start:dev       # Iniciar con hot-reload (desarrollo)
npm run start:debug    # Iniciar con debugger
npm run start:prod     # Iniciar desde dist/
```

### Lint & Format

```bash
npm run lint            # ESLint con autofix
npm run format          # Prettier con write
```

### Database

```bash
npm run seed            # Importar líneas desde GeoJSON
```

### Tests

```bash
npm run test            # Ejecutar todos los tests
npm run test:watch      # Tests en watch mode
npm run test:cov        # Tests con coverage
npm run test:e2e        # Tests E2E

# Test específico (usar con --)
jest src/modules/auth/auth.service.spec.ts
jest --testPathPattern="auth.service"
jest --testNamePattern="should login"
```

---

## Code Style Guidelines

### Project Structure

```
src/
├── common/              # Shared code (decorators, guards, filters)
│   ├── decorators/
│   ├── filters/
│   └── guards/
├── config/              # Configuration
├── modules/             # Feature modules
│   ├── auth/
│   │   ├── dto/
│   │   ├── strategies/
│   │   └── *.ts
│   ├── users/
│   ├── lines/
│   └── favorites/
└── *.module.ts
```

### Naming Conventions

| Element       | Convention  | Example                        |
| ------------- | ----------- | ------------------------------ |
| Files         | kebab-case  | `auth.service.ts`              |
| Classes       | PascalCase  | `AuthService`, `UserEntity`    |
| Variables     | camelCase   | `userId`, `createdAt`          |
| Constants     | UPPER_SNAKE | `MAX_DISTANCE`, `JWT_SECRET`   |
| Enums         | PascalCase  | `LineSense.Outbound`           |
| DTOs          | PascalCase  | `RegisterDto`, `LoginDto`      |
| Database cols | snake_case  | `created_at`, `parent_line_id` |

### Imports

**Order (enforce by ESLint):**

1. Node.js built-ins (`import { ... } from 'node:...'`)
2. External packages (`@nestjs/common`, `class-validator`)
3. Internal modules (`../users/users.service`)
4. Relative files (`./auth.service`)

**Patterns:**

```typescript
// Good
import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';

// Bad - avoid default exports for services
import UsersService from '../users/users.service';
```

### TypeScript

- **Use explicit types** for function parameters and return types
- **Avoid `any`** - use `unknown` when type is truly unknown
- **Prefer interfaces** for DTOs and data shapes
- **Use enums** for fixed sets of values

```typescript
// Good
async findById(id: string): Promise<User | null> {
  return this.userRepository.findOne({ where: { id } });
}

// Bad - implicit any
async findById(id) {
  return this.userRepository.findOne({ where: { id } });
}
```

### NestJS Patterns

#### Module Structure

```typescript
// *.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Entity])],
  controllers: [],
  providers: [Service],
  exports: [Service],
})
export class ModuleNameModule {}
```

#### Service Structure

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

#### DTO Structure with Validation

```typescript
// Use class-validator decorators
import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}
```

#### Controller Structure

```typescript
@ApiTags('resource')
@Controller('resource')
export class ResourceController {
  constructor(private readonly service: ResourceService) {}

  @Get()
  @Public() // Bypass JWT guard
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateDto) {
    return this.service.create(dto);
  }
}
```

### Error Handling

- Use NestJS built-in exceptions
- Include descriptive messages in Spanish (project language)
- Return consistent error format via HttpExceptionFilter

```typescript
// Good
throw new NotFoundException('Usuario no encontrado');
throw new ConflictException('El email ya está registrado');
throw new UnauthorizedException('Credenciales inválidas');

// Bad
throw new Error('not found');
```

### Database (TypeORM)

- Use UUID for primary keys
- Use snake_case for column names in decorators
- Use camelCase for TypeScript properties
- Use `autoLoadEntities: true` in TypeORM config

```typescript
@Column({ name: 'created_at' })
createdAt: Date;

@Column({ name: 'geo_json', type: 'jsonb', nullable: true })
geoJson: object;
```

### API Response Format

```typescript
// Success
{
  data: { ... },
  message: 'Operation successful'
}

// Error (handled by HttpExceptionFilter)
{
  statusCode: 400,
  message: ['validation error'],
  error: 'Bad Request',
  timestamp: '2024-01-01T00:00:00.000Z'
}
```

### Documentation (Swagger)

- Add `@ApiProperty` with examples to all DTOs
- Use `@ApiTags` for grouping endpoints
- Add `@ApiOperation` for endpoint descriptions
- Use `@ApiResponse` for documented responses

```typescript
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() dto: LoginDto) {}
}
```

---

## Environment Variables

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=transporte_scz
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3000
NODE_ENV=development
```

---

## Testing Guidelines

- Place spec files next to source files: `auth.service.ts` → `auth.service.spec.ts`
- Use `@nestjs/testing` for unit tests
- Mock dependencies with `jest.fn()`
- Use descriptive test names in Spanish or English

```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should return user and token on valid credentials', async () => {
      // Test implementation
    });

    it('should throw UnauthorizedException on invalid credentials', async () => {
      // Test implementation
    });
  });
});
```

---

## PostgreSQL Note

This project uses PostgreSQL with TypeORM `synchronize: true` for development.
Create database manually: `CREATE DATABASE transporte_scz;`

Endpoints available at:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/api/docs`
