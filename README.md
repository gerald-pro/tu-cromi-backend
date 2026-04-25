# Tu Cromi Backend

API backend para el sistema de transporte público de Santa Cruz de la Sierra.

## Sistema de Transporte

Santa Cruz opera con micros sin paradas fijas. Cualquier punto de la ruta puede ser punto de abordaje o bajada.

### Datos

- **272 líneas** con polilíneas de ~335 puntos cada una
- Las líneas de ida y vuelta son registros separados (`sense: OUTBOUND | RETURN`)
- No hay paradas fijas — cualquier punto de la polilínea es válido.

### Trasbordo

Un trasbordo requiere caminar entre líneas. Los puntos válidos están precalculados en `line_transfers`.

El viaje solo es válido si el punto de abordaje aparece antes que el punto de bajada en la polilínea.

---

## API Reference

Swagger disponible en `http://localhost:3000/api/docs`

### Endpoints

| Módulo    | Ruta         | Descripción                |
| --------- | ------------ | -------------------------- |
| Auth      | `/auth`      | Login/registro de usuarios |
| Users     | `/users`     | Gestión de usuarios        |
| Lines     | `/lines`     | Líneas de transporte       |
| Favorites | `/favorites` | Líneas favoritas           |
| Search    | `/search`    | Búsqueda de rutas          |

---

## Setup

```bash
# Instalar dependencias
npm install

# Crear base de datos
CREATE DATABASE tucromi;

# Ejecutar migraciones
npm run db:migrate

# Importar líneas (opcional)
npm run seed

# Iniciar desarrollo
npm run start:dev
```

---

## Configuración

Variables de entorno (ver `.env.example`):

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

## Commands

```bash
npm run seed              # Importar líneas desde GeoJSON
npm run db:migrate        # Ejecutar migraciones
npm run compute:transfers # Calcular trasbordos
```

---

## Testing

```bash
npm run test              # Tests unitarios
npm run test:watch        # Watch mode
npm run test:cov         # Coverage
npm run test:e2e         # E2E
```

---

## Tech Stack

- NestJS + TypeScript
- PostgreSQL + TypeORM
- Passport + JWT
- Swagger (OpenAPI)
