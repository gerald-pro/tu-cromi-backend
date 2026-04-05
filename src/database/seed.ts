import { DataSource } from 'typeorm';
import { Line } from '../modules/lines/line.entity';
import { Favorite } from '../modules/favorites/favorite.entity';
import { User } from '../modules/users/user.entity';
import { LineSense } from '../modules/lines/line-sense.enum';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const geoJsonPath = path.join(__dirname, '../data/rutas_scz.geojson');
const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf-8'));

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
    origen: number;
    medio: number;
    destino: number;
    desdoble: number;
    sindicato: number;
    parque_a: number;
  };
}

interface GeoJsonData {
  type: string;
  features: GeoJsonFeature[];
}

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    database: process.env.DATABASE_NAME || 'transporte_scz',
    username: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
    entities: [Line, Favorite, User],
    synchronize: true,
  });

  await dataSource.initialize();
  console.log('Database connected');

  const lineRepo = dataSource.getRepository(Line);
  const existingLines = await lineRepo.count();

  if (existingLines > 0) {
    console.log('Lines already seeded, skipping...');
    await dataSource.destroy();
    return;
  }

  console.log('Seeding lines from GeoJSON...');
  const data = geoJsonData as unknown as GeoJsonData;
  const lines: Partial<Line>[] = [];

  for (const feature of data.features) {
    const line = new Line();
    line.objectid = feature.properties.objectid;
    line.code = feature.properties.nombre;
    line.sense =
      feature.properties.sentido === 1 ? LineSense.OUTBOUND : LineSense.RETURN;
    line.syndicate = `Sindicato ${feature.properties.sindicato}`;
    line.geoJson = {
      type: 'MultiLineString',
      coordinates: feature.geometry.coordinates,
    };
    lines.push(line);
  }

  const savedLines = await lineRepo.save(lines);
  console.log(`Created ${savedLines.length} lines`);

  console.log('Linking opposite lines...');
  const lineMap = new Map<string, Line[]>();
  for (const line of savedLines) {
    const key = line.code;
    if (!lineMap.has(key)) {
      lineMap.set(key, []);
    }
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

  await lineRepo.save(updates);
  console.log(`Linked ${updates.length / 2} pairs of opposite lines`);

  await dataSource.destroy();
  console.log('Seeding completed!');
}

seed().catch(console.error);
