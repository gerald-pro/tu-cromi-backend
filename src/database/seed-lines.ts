import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Line } from '../modules/lines/line.entity';
import { LineSense } from '../modules/lines/line-sense.enum';
import { Favorite } from '../modules/favorites/favorite.entity';
import { Review } from '../modules/reviews/review.entity';
import { User } from '../modules/users/user.entity';

dotenv.config({ path: path.join(__dirname, '../../.env') });

interface GeoJsonFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  properties: {
    objectid: number;
    nombre: string;
    sentido: number;
    sindicato: number;
    other: Record<string, unknown>;
  };
}

interface GeoJsonData {
  type: string;
  features: GeoJsonFeature[];
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'tucromi',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  entities: [Line, Favorite, Review, User],
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

async function seedLines(): Promise<void> {
  await dataSource.initialize();
  console.log('Database connected');

  const lineRepository = dataSource.getRepository(Line);
  const existingLines = await lineRepository.count();

  if (existingLines > 0) {
    console.log(
      `Lines already seeded (${existingLines} found). Use --force to reseed by deleting first.`,
    );
    await dataSource.destroy();
    return;
  }

  const geoJsonPath = path.resolve(
    __dirname,
    '../data/rutas_scz.geojson',
  );
  if (!fs.existsSync(geoJsonPath)) {
    console.error(`GeoJSON file not found: ${geoJsonPath}`);
    process.exit(1);
  }

  const geoJsonData = JSON.parse(
    fs.readFileSync(geoJsonPath, 'utf-8'),
  ) as unknown as GeoJsonData;

  console.log(`Importing ${geoJsonData.features.length} features...`);

  const lines: Line[] = [];

  for (const feature of geoJsonData.features) {
    const line = new Line();
    line.objectid = feature.properties.objectid;
    line.code = feature.properties.nombre;
    line.sense =
      feature.properties.sentido === 1
        ? LineSense.OUTBOUND
        : LineSense.RETURN;
    line.syndicate = `Sindicato ${feature.properties.sindicato}`;
    line.geoJson = {
      type: 'MultiLineString',
      coordinates: feature.geometry.coordinates,
    };
    lines.push(line);
  }

  const savedLines = await lineRepository.save(lines);
  console.log(`Created ${savedLines.length} lines`);

  await linkOppositeLines(lineRepository, savedLines);
  await buildGeometryColumn(lineRepository);

  await dataSource.destroy();
  console.log('Seed complete');
}

async function linkOppositeLines(
  repo: ReturnType<DataSource['getRepository']>,
  lines: Line[],
): Promise<void> {
  const lineMap = new Map<string, Line[]>();
  for (const line of lines) {
    const key = line.code;
    if (!lineMap.has(key)) lineMap.set(key, []);
    lineMap.get(key)!.push(line);
  }

  const updates: Line[] = [];
  for (const [, sameCodeLines] of lineMap) {
    if (sameCodeLines.length === 2) {
      const [line1, line2] = sameCodeLines;
      if (line1.sense === LineSense.OUTBOUND) {
        line1.parentLineId = line2.id;
        line2.parentLineId = line1.id;
      } else {
        line2.parentLineId = line1.id;
        line1.parentLineId = line2.id;
      }
      updates.push(line1, line2);
    }
  }

  await repo.save(updates);
  console.log(`Linked ${updates.length / 2} pairs of opposite lines`);
}

async function buildGeometryColumn(
  repo: ReturnType<DataSource['getRepository']>,
): Promise<void> {
  const [{ exists }]: [{ exists: boolean }] = await repo.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'lines' AND column_name = 'geom'
    ) as exists
  `);

  if (!exists) {
    console.warn('geom column not found, skipping geometry population');
    return;
  }

  await repo.query(`
    UPDATE lines 
    SET geom = ST_GeomFromGeoJSON(geo_json::text)
    WHERE geo_json IS NOT NULL AND geom IS NULL
  `);
  console.log('Geometry column populated');
}

seedLines().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
