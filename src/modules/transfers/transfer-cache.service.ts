import { Injectable, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TransferNode {
  lineAId: string;
  lineBId: string;
  pointAIndex: number;
  pointALng: number;
  pointALat: number;
  pointBIndex: number;
  pointBLng: number;
  pointBLat: number;
  walkDistance: number;
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

@Injectable()
export class TransferCacheService implements OnModuleInit {
  private transferMap = new Map<string, TransferNode[]>();
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

    const map = new Map<string, TransferNode[]>();
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

      const existing = map.get(r.line_a_id) ?? [];
      existing.push(node);
      map.set(r.line_a_id, existing);
    }

    this.transferMap = map;
    this.isLoaded = true;
    console.log(
      `[TransferCache] Loaded ${rows.length} transfers for ${map.size} lines`,
    );
  }

  getTransfersFrom(lineId: string): TransferNode[] {
    return this.transferMap.get(lineId) ?? [];
  }

  hasLoaded(): boolean {
    return this.isLoaded;
  }

  reload(): Promise<void> {
    return this.load();
  }
}
