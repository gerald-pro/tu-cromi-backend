# Arquitectura Backend - Tu Cromi

## Overview

Backend NestJS para aplicación de transporte público de Santa Cruz de la Sierra. MVP con autenticación, gestión de líneas y búsqueda de rutas.

## Stack Tecnológico

| Componente    | Tecnología      | Versión |
| ------------- | --------------- | ------- |
| Framework     | NestJS          | ^11.x   |
| Runtime       | Node.js         | 20+     |
| Lenguaje      | TypeScript      | ^5.x    |
| Base de Datos | PostgreSQL      | 16+     |
| ORM           | TypeORM         | ^0.3.x  |
| API Docs      | Swagger         | ^7.x    |
| Validación    | class-validator | ^0.14.x |
| Auth          | Passport JWT    | -       |
| Testing       | Jest            | ^30.x   |

## Estructura del Proyecto

```
tu-cromi-backend/
├── src/
│   ├── main.ts                    # Bootstrap de la aplicación
│   ├── app.module.ts              # Módulo raíz
│   │
│   ├── common/                    # Código compartido
│   │   ├── decorators/            # @CurrentUser, @Public
│   │   ├── dto/                   # DTOs genéricos (PaginationDto)
│   │   ├── filters/               # HttpExceptionFilter
│   │   └── guards/                # JwtAuthGuard
│   │
│   ├── config/                    # Configuración
│   │   └── configuration.ts       # Environment variables
│   │
│   ├── modules/                   # Módulos de negocio
│   │   ├── auth/                  # Autenticación
│   │   │   ├── dto/               # LoginDto, RegisterDto
│   │   │   ├── strategies/        # JwtStrategy
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── users/                 # Usuarios
│   │   │   ├── user.entity.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── lines/                 # Líneas de micro
│   │   │   ├── line.entity.ts
│   │   │   ├── lines.controller.ts
│   │   │   ├── lines.service.ts
│   │   │   └── lines.module.ts
│   │   │
│   │   ├── favorites/             # Favoritos
│   │   │   ├── favorite.entity.ts
│   │   │   ├── favorites.controller.ts
│   │   │   ├── favorites.service.ts
│   │   │   └── favorites.module.ts
│   │   │
│   │   └── search/                # Búsqueda de rutas
│   │       ├── dto/
│   │       ├── search.controller.ts
│   │       ├── search.service.ts
│   │       └── search.module.ts
│   │
│   ├── database/
│   │   └── seed.ts               # Script para importar GeoJSON
│   │
│   └── data/
│       └── rutas_scz.geojson      # Datos de rutas
│
├── test/                           # Tests E2E
├── .env                            # Variables de entorno
├── .env.example                    # Template de .env
├── package.json
├── tsconfig.json
└── nest-cli.json
```

## Modelo de Datos

### User

```typescript
{
  id: UUID,           // PK
  email: string,      // unique, not null
  password: string,   // hashed, not null
  createdAt: Date,
  updatedAt: Date
}
```

### Line

```typescript
{
  id: UUID,           // PK
  code: string,       // Número de línea (ej: "1", "101")
  name: string,       // Nombre descriptivo
  color: string,      // Color hex (ej: "#FF0000")
  geoJson: JSONB,     // MultiLineString con coordenadas
  sense: enum,         // OUTBOUND | RETURN
  parentLineId: UUID,  // FK a la línea de sentido contrario
  syndicate: string,   // Sindicato
  createdAt: Date,
  updatedAt: Date
}
```

### Favorite

```typescript
{
  id: UUID,           // PK
  userId: UUID,       // FK -> User
  lineId: UUID,       // FK -> Line
  name: string,       // Nombre personalizado (opcional)
  createdAt: Date
}
```

## API Endpoints

### Auth (público)

```
POST   /api/auth/register   # Registrar usuario
POST   /api/auth/login      # Iniciar sesión → JWT
```

### Lines (público)

```
GET    /api/lines           # Listar todas las líneas
GET    /api/lines/:id       # Detalle de línea + geoJson
GET    /api/lines/:id/opposite  # Línea de sentido contrario
```

### Search (público)

```
POST   /api/search          # Buscar ruta origen → destino
     Body: {
       origin: { lat: number, lng: number },
       destination: { lat: number, lng: number }
     }
     Response: {
       routes: [...],        // Tramos de la ruta
       totalDistance: number,   // metros
       totalWalk: number,       // metros caminando
       estimatedTime: number,    // minutos
       transfers: number         // número de cambios
     }
```

### Favorites (protegido)

```
GET    /api/favorites       # Mis favoritos
POST   /api/favorites       # Agregar favorito
DELETE /api/favorites/:id   # Eliminar favorito
```

### Users (protegido)

```
GET    /api/users/me        # Mi perfil
```

## Convenciones de Código

### Naming

| Elemento   | Convention  | Ejemplo               |
| ---------- | ----------- | --------------------- |
| Archivos   | kebab-case  | `lines.service.ts`    |
| Clases     | PascalCase  | `LinesService`        |
| Variables  | camelCase   | `lineId`, `createdAt` |
| Constantes | UPPER_SNAKE | `MAX_WALK_DISTANCE`   |
| Enums      | PascalCase  | `LineSense.Outbound`  |

### Respuestas API

```typescript
// Éxito
{
  status: 'success',
  code: 'OK',
  message: 'Operación exitosa',
  data: {...}
}

// Error
{
  status: 'error',
  code: 'NOT_FOUND',
  message: 'Recurso no encontrado',
  data: null
}
```

### Códigos de Respuesta

```typescript
// Éxito
OK; // Éxito genérico

// Error genéricos
UNAUTHORIZED; // No autenticado
FORBIDDEN; // Sin permisos
NOT_FOUND; // Recurso no encontrado
CONFLICT; // Conflicto (ej: email duplicado)
VALIDATION_ERROR; // Error de validación
BAD_REQUEST; // Request inválido
INTERNAL_ERROR; // Error interno

// Error específico (solo si front necesita lógica)
AUTH_INVALID_CREDENTIALS;
AUTH_TOKEN_EXPIRED;
```

### Git Commits

```
feat: nueva funcionalidad
fix: corrección de bug
chore: mantenimiento
refactor: refactorización
docs: documentación
test: tests
```

## Algoritmo de Búsqueda

### Concepto

Construir un **grafo dinámico** donde:

- **Nodos**: Puntos del GeoJSON de todas las líneas
- **Aristas**: Conexiones entre puntos de la misma línea + conexiones por proximidad entre líneas

### Flujo

1. Recibir coordenadas de origen y destino
2. Encontrar puntos cercanos (500m) en las líneas existentes
3. Construir subgrafo con puntos relevantes
4. Ejecutar A\* con costos ponderados:
   - Caminar = 3x (penalizado)
   - Transferir = 2x
   - Micro = 1x
5. Retornar mejores K rutas ordenadas por tiempo/distancia

### Costos y Penalizaciones

```
Costo base: distancia en metros
Costo caminar: distancia * 3
Costo transferencia: 500m + tiempo espera estimado
```

## Configuración de Entorno

```env
# Database
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=transporte_scz
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# App
PORT=3000
NODE_ENV=development
```

## Roadmap de Implementación

- [x] **Paso 1**: Setup - NestJS, TypeORM, Swagger, Guards, Filters
- [x] **Paso 2**: Base de datos - PostgreSQL (externo), entidades, servicios
- [x] **Paso 3**: Auth - User entity, Register, Login, JWT
- [x] **Paso 4**: Lines - Line entity, controllers
- [x] **Paso 5**: Favorites - CRUD, protegido con JWT
- [x] **Paso 6**: Search - Seeder GeoJSON, endpoint POST /search
- [ ] **Pendiente**: Algoritmo mejorado con transfers (múltiples micros)

## Notas Importantes

- **Sin paradas formales**: En Santa Cruz los micros paran donde el pasajero avisa
- **GeoJSON como fuente**: Las coordenadas vienen del archivo GeoJSON existente
- **Sin tiempo real**: MVP no incluye tracking GPS de micros
- **Modo offline**: Postergado para versión posterior
