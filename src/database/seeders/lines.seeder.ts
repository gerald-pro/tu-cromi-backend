import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Line } from '../../modules/lines/line.entity';
import { LineSense } from '../../modules/lines/line-sense.enum';

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

@Injectable()
export class LinesSeeder {
  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async run(force = false): Promise<void> {
    const geoJsonPath = path.join(__dirname, '../../data/rutas_scz.geojson');
    const geoJsonData = JSON.parse(fs.readFileSync(geoJsonPath, 'utf-8'));

    const existingLines = await this.lineRepository.count();

    if (existingLines > 0 && !force) {
      console.log('Lines already seeded, skipping. Use --force to reseed.');
      return;
    }

    if (force && existingLines > 0) {
      console.log(`Deleting ${existingLines} existing lines...`);
      await this.lineRepository.query('DELETE FROM lines');
    }

    console.log('Seeding lines from GeoJSON...');
    const data = geoJsonData as unknown as GeoJsonData;
    const lines: Partial<Line>[] = [];

    for (const feature of data.features) {
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

    const savedLines = await this.lineRepository.save(lines);
    console.log(`Created ${savedLines.length} lines`);

    await this.linkOppositeLines(savedLines);
    await this.buildGeometryColumn();
  }

  private async buildGeometryColumn(): Promise<void> {
    const [{ exists }]: [{ exists: boolean }] = await this.lineRepository
      .query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lines' AND column_name = 'geom'
      ) as exists
    `);

    if (!exists) {
      console.warn('geom column not found, skipping geometry population');
      return;
    }

    console.log('Populating geometry column...');
    await this.lineRepository.query(`
      UPDATE lines 
      SET geom = ST_GeomFromGeoJSON(geo_json::text)
      WHERE geo_json IS NOT NULL AND geom IS NULL
    `);
    console.log('Geometry column populated');
  }

  private async linkOppositeLines(lines: Line[]): Promise<void> {
    console.log('Linking opposite lines...');

    const lineMap = new Map<string, Line[]>();
    for (const line of lines) {
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

    await this.lineRepository.save(updates);
    console.log(`Linked ${updates.length / 2} pairs of opposite lines`);
  }
}
