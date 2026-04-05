import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Line } from '../../modules/lines/line.entity';
import { LineSense } from '../../modules/lines/line-sense.enum';
import geoJsonData from '../../data/rutas_scz.geojson';

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
  private readonly logger = new Logger(LinesSeeder.name);

  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async seed(): Promise<void> {
    const existingLines = await this.lineRepository.count();
    if (existingLines > 0) {
      this.logger.log('Lines already seeded, skipping...');
      return;
    }

    this.logger.log('Seeding lines from GeoJSON...');
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
    this.logger.log(`Created ${savedLines.length} lines`);

    await this.linkOppositeLines(savedLines);
  }

  private async linkOppositeLines(lines: Line[]): Promise<void> {
    this.logger.log('Linking opposite lines...');

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
    this.logger.log(`Linked ${updates.length / 2} pairs of opposite lines`);
  }
}
