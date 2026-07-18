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
  private transferMap = new Map<number, TransferNode[]>();
  private lineCache = new Map<number, LineData>();
  private isLoaded = false;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async reload(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    await Promise.all([this.loadTransfers(), this.loadLines()]);
    this.isLoaded = true;
  }

  private async loadTransfers(): Promise<void> {
    const rows = await this.dataSource.query(`
      SELECT line_a_id, line_b_id,
             point_a_index, point_a_lng, point_a_lat,
             point_b_index, point_b_lng, point_b_lat,
             walk_distance
      FROM line_transfers
    `);

    const map = new Map<number, TransferNode[]>();
    for (const r of rows) {
      const node: TransferNode = {
        lineAId: r.line_a_id,
        lineBId: r.line_b_id,
        pointAIndex: r.point_a_index,
        pointALng: r.point_a_lng,
        pointALat: r.point_a_lat,
        pointBIndex: r.point_b_index,
        pointBLng: r.point_b_lng,
        pointBLat: r.point_b_lat,
        walkDistance: r.walk_distance,
      };
      const existing = map.get(node.lineAId) ?? [];
      existing.push(node);
      map.set(node.lineAId, existing);
    }
    this.transferMap = map;
    this.logger.log(`Loaded ${rows.length} transfers for ${map.size} lines`);
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
    this.logger.log(`Loaded ${cache.size} lines into cache`);
  }

  getTransfersFrom(lineId: number): TransferNode[] {
    return this.transferMap.get(lineId) ?? [];
  }

  getLineData(lineId: number): LineData | undefined {
    return this.lineCache.get(lineId);
  }

  getAllLines(): LineData[] {
    return Array.from(this.lineCache.values());
  }

  hasLoaded(): boolean {
    return this.isLoaded;
  }
}
