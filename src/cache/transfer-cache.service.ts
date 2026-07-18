import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TransferNode {
  lineAId: number;
  lineBId: number;
  pointAIndex: number;
  pointALng: number;
  pointALat: number;
  pointBIndex: number;
  pointBLng: number;
  pointBLat: number;
  walkDistance: number;
}

export interface LineData {
  id: number;
  code: string;
  name: string;
  color: string;
  sense: string;
  polyline: number[][];
}

@Injectable()
export class TransferCacheService implements OnModuleInit {
  private readonly logger = new Logger(TransferCacheService.name);
  private transferCache = new Map<number, TransferNode[]>();
  private lineCache = new Map<number, LineData>();

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    // Only load lines at boot — transfers are lazy-loaded per line
    await this.loadLines();
    this.logger.log(`Loaded ${this.lineCache.size} lines into cache`);
  }

  async reload(): Promise<void> {
    this.transferCache.clear();
    this.lineCache.clear();
    await this.loadLines();
    this.logger.log(`Cache reloaded — ${this.lineCache.size} lines`);
  }

  async getTransfersFrom(lineId: number): Promise<TransferNode[]> {
    const cached = this.transferCache.get(lineId);
    if (cached !== undefined) return cached;

    const rows = await this.dataSource.query(
      `SELECT line_a_id, line_b_id,
              point_a_index, point_a_lng, point_a_lat,
              point_b_index, point_b_lng, point_b_lat,
              walk_distance
       FROM line_transfers
       WHERE line_a_id = ?`,
      [lineId],
    );

    const nodes: TransferNode[] = rows.map((r: any) => ({
      lineAId: r.line_a_id,
      lineBId: r.line_b_id,
      pointAIndex: r.point_a_index,
      pointALng: r.point_a_lng,
      pointALat: r.point_a_lat,
      pointBIndex: r.point_b_index,
      pointBLng: r.point_b_lng,
      pointBLat: r.point_b_lat,
      walkDistance: r.walk_distance,
    }));

    this.transferCache.set(lineId, nodes);
    return nodes;
  }

  getLineData(lineId: number): LineData | undefined {
    return this.lineCache.get(lineId);
  }

  getAllLines(): LineData[] {
    return Array.from(this.lineCache.values());
  }

  private async loadLines(): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT id, code, name, color, sense, geo_json FROM lines`,
    );

    const cache = new Map<number, LineData>();
    for (const row of rows) {
      const raw =
        typeof row.geo_json === 'string'
          ? JSON.parse(row.geo_json)
          : row.geo_json;
      const coords: number[][][] = Array.isArray(raw)
        ? (raw as number[][][])
        : (raw.coordinates as number[][][]);
      const polyline = coords?.[0];
      if (!polyline) continue;

      cache.set(row.id, {
        id: row.id,
        code: row.code,
        name: row.name || row.code,
        color: row.color || '#3B82F6',
        sense: row.sense,
        polyline,
      });
    }
    this.lineCache = cache;
  }
}
