import { Injectable, OnModuleInit } from '@nestjs/common';
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
  polyline: number[][];
}

interface TransferRow {
  line_a_id: string;
  line_b_id: string;
  point_a_index: number;
  point_a_lng: number;
  point_a_lat: number;
  point_b_index: number;
  point_b_lng: number;
  point_b_lat: number;
  walk_distance: number;
}

interface LineRow {
  id: string;
  code: string;
  name: string;
  color: string;
  geo_json: { type: string; coordinates: number[][][] };
}

const LINE_CACHE_LIMIT = 500;

@Injectable()
export class TransferCacheService implements OnModuleInit {
  private transferMap = new Map<number, TransferNode[]>();
  private lineCache = new Map<number, LineData>();
  private isLoaded = false;

  constructor(private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const rows: TransferRow[] = await this.dataSource.query(
      `
      SELECT
        line_a_id, line_b_id,
        point_a_index, point_a_lng, point_a_lat,
        point_b_index, point_b_lng, point_b_lat,
        walk_distance
      FROM line_transfers
      `,
    );

    const map = new Map<number, TransferNode[]>();
    for (const r of rows) {
      const node: TransferNode = {
        lineAId: parseInt(r.line_a_id as unknown as string, 10),
        lineBId: parseInt(r.line_b_id as unknown as string, 10),
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
    this.isLoaded = true;
    console.log(
      `[TransferCache] Loaded ${rows.length} transfers for ${map.size} lines`,
    );
  }

  getTransfersFrom(lineId: number): TransferNode[] {
    return this.transferMap.get(lineId) ?? [];
  }

  async getOrLoadLine(lineId: number): Promise<LineData | undefined> {
    const cached = this.lineCache.get(lineId);
    if (cached) return cached;

    return this.loadLine(lineId);
  }

  private async loadLine(lineId: number): Promise<LineData | undefined> {
    const rows: LineRow[] = await this.dataSource.query(
      `SELECT id, code, name, color, geo_json FROM lines WHERE id = $1`,
      [lineId],
    );

    if (!rows[0]?.geo_json?.coordinates?.[0]) return undefined;

    const lineData: LineData = {
      id: parseInt(rows[0].id, 10),
      code: rows[0].code,
      name: rows[0].name || rows[0].code,
      color: rows[0].color || '#3B82F6',
      polyline: rows[0].geo_json.coordinates[0],
    };

    this.setLineCache(lineData);
    return lineData;
  }

  private setLineCache(lineData: LineData): void {
    if (this.lineCache.size >= LINE_CACHE_LIMIT) {
      const firstKey = this.lineCache.keys().next().value;
      if (firstKey) this.lineCache.delete(firstKey);
    }
    this.lineCache.set(lineData.id, lineData);
  }

  getLineCacheSize(): number {
    return this.lineCache.size;
  }

  getLineCache(): Map<number, LineData> {
    return this.lineCache;
  }

  hasLoaded(): boolean {
    return this.isLoaded;
  }

  reload(): Promise<void> {
    return this.load();
  }
}
