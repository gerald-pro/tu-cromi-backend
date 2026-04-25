import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Line } from '../lines/line.entity';
import {
  TransferCacheService,
  TransferNode,
} from '../transfers/transfer-cache.service';
import { SearchRouteDto } from './dto';

// ─── Umbrales ────────────────────────────────────────────────────────────────

const MAX_WALK_ORIGIN = 400;
const MAX_WALK_DESTINATION = 400;
const MAX_WALK_TRANSFER = 300;
const WALK_SPEED = 50; // metros por minuto
const RIDE_SPEED = 250; // metros por minuto
const MAX_RESULTS = 5;

// ─── Interfaces públicas ─────────────────────────────────────────────────────

export interface JourneyLeg {
  type: 'walk' | 'ride';
  from: [number, number];
  to: [number, number];
  distance: number;
  lineId?: string;
  lineCode?: string;
  lineName?: string;
  lineColor?: string;
  polyline?: number[][];
}

export interface JourneyOption {
  id: string;
  totalDistance: number;
  totalWalk: number;
  estimatedTime: number;
  transfers: number;
  legs: JourneyLeg[];
}

// ─── Interfaces internas ─────────────────────────────────────────────────────

interface CandidateLine {
  id: string;
  code: string;
  name: string;
  color: string;
  polyline: number[][];
  boardIndex: number;
  boardPoint: [number, number];
  boardDistance: number;
  alightIndex: number;
  alightPoint: [number, number];
  alightDistance: number;
}

interface LineRow {
  id: string;
  code: string;
  name: string;
  color: string;
  geo_json: { type: string; coordinates: number[][][] };
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
export class SearchService {
  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
    private readonly transferCache: TransferCacheService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Entry point ───────────────────────────────────────────────────────────

  async search(dto: SearchRouteDto): Promise<{ options: JourneyOption[] }> {
    const origin = this.parseCoordinates(dto.origin);
    const destination = this.parseCoordinates(dto.destination);

    // 1. Filtrado geográfico
    const originCandidates = await this.findCandidateLines(
      origin,
      destination,
      MAX_WALK_ORIGIN,
    );
    const destCandidates = await this.findCandidateLines(
      destination,
      origin,
      MAX_WALK_DESTINATION,
    );

    if (originCandidates.length === 0 || destCandidates.length === 0) {
      return { options: [] };
    }

    const destCandidateIds = new Set(destCandidates.map((l) => l.id));
    const destCandidateMap = new Map(destCandidates.map((l) => [l.id, l]));

    const options: JourneyOption[] = [];

    // 2. Rutas directas
    const directRoutes = this.buildDirectRoutes(
      originCandidates,
      destCandidateIds,
      destCandidateMap,
      origin,
      destination,
    );
    options.push(...directRoutes);

    // 3. Rutas con 1 trasbordo
    const oneTransferRoutes = await this.buildOneTransferRoutes(
      originCandidates,
      destCandidateIds,
      destCandidateMap,
      origin,
      destination,
    );
    options.push(...oneTransferRoutes);

    // 4. Rutas con 2 trasbordos
    const twoTransferRoutes = await this.buildTwoTransferRoutes(
      originCandidates,
      destCandidateIds,
      destCandidateMap,
      origin,
      destination,
    );
    options.push(...twoTransferRoutes);

    // 5. Ranking y retorno
    return { options: this.rankAndSlice(options) };
  }

  // ─── Step 1: Filtrado geográfico ───────────────────────────────────────────

  private async findCandidateLines(
    near: [number, number],
    target: [number, number],
    radiusMeters: number,
  ): Promise<CandidateLine[]> {
    // PostGIS filtra líneas dentro del radio usando el índice GIST
    const rows: LineRow[] = await this.dataSource.query(
      `
      SELECT l.id, l.code, l.name, l.color, l.geo_json
      FROM lines l
      WHERE ST_DWithin(
        l.geom::geography,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        $3
      )
      `,
      [near[0], near[1], radiusMeters],
    );

    const candidates: CandidateLine[] = [];

    for (const row of rows) {
      if (!row.geo_json?.coordinates?.[0]) continue;
      const polyline = row.geo_json.coordinates[0];

      const boardResult = this.findClosestPoint(polyline, near);
      const alightResult = this.findClosestPoint(polyline, target);

      if (!boardResult || !alightResult) continue;

      // Validar distancia de caminata al punto de abordaje
      if (boardResult.distance > radiusMeters) continue;

      candidates.push({
        id: row.id,
        code: row.code,
        name: row.name || row.code,
        color: row.color || '#3B82F6',
        polyline,
        boardIndex: boardResult.index,
        boardPoint: boardResult.point,
        boardDistance: boardResult.distance,
        alightIndex: alightResult.index,
        alightPoint: alightResult.point,
        alightDistance: alightResult.distance,
      });
    }

    return candidates;
  }

  // ─── Step 2: Rutas directas ────────────────────────────────────────────────

  private buildDirectRoutes(
    originCandidates: CandidateLine[],
    destCandidateIds: Set<string>,
    destCandidateMap: Map<string, CandidateLine>,
    origin: [number, number],
    destination: [number, number],
  ): JourneyOption[] {
    const options: JourneyOption[] = [];

    for (const originLine of originCandidates) {
      // La línea debe aparecer también en los candidatos de destino
      if (!destCandidateIds.has(originLine.id)) continue;

      const destLine = destCandidateMap.get(originLine.id)!;

      // Validar dirección: el abordaje debe ocurrir antes del descenso
      if (originLine.boardIndex >= destLine.alightIndex) continue;

      // Validar distancia de caminata al destino
      if (destLine.alightDistance > MAX_WALK_DESTINATION) continue;

      const ridePolyline = originLine.polyline.slice(
        originLine.boardIndex,
        destLine.alightIndex + 1,
      );
      const rideDistance = this.calculatePolylineDistance(ridePolyline);

      const legs: JourneyLeg[] = [];

      if (originLine.boardDistance > 0) {
        legs.push({
          type: 'walk',
          from: origin,
          to: originLine.boardPoint,
          distance: Math.round(originLine.boardDistance),
        });
        // corregir el from con el origen real
        legs[0].from = this.getOriginFromCandidate(originLine);
      }

      legs.push({
        type: 'ride',
        from: originLine.boardPoint,
        to: destLine.alightPoint,
        distance: Math.round(rideDistance),
        lineId: originLine.id,
        lineCode: originLine.code,
        lineName: originLine.name,
        lineColor: originLine.color,
        polyline: ridePolyline,
      });

      if (destLine.alightDistance > 0) {
        legs.push({
          type: 'walk',
          from: destLine.alightPoint,
          to: destination,
          distance: Math.round(destLine.alightDistance),
        });
      }

      options.push(this.buildJourneyOption(legs, 0));
    }

    return options;
  }

  // ─── Step 3: Rutas con 1 trasbordo ────────────────────────────────────────

  private async buildOneTransferRoutes(
    originCandidates: CandidateLine[],
    destCandidateIds: Set<string>,
    destCandidateMap: Map<string, CandidateLine>,
    origin: [number, number],
    destination: [number, number],
  ): Promise<JourneyOption[]> {
    const options: JourneyOption[] = [];

    for (const line1 of originCandidates) {
      // Consultar transfers desde línea 1
      const transfers = this.getTransfersFrom(line1.id);

      for (const transfer of transfers) {
        // ¿La línea 2 llega al destino?
        if (!destCandidateIds.has(transfer.lineBId)) continue;

        const line2Dest = destCandidateMap.get(transfer.lineBId)!;

        // Validar dirección en línea 1: abordaje → punto de trasbordo
        if (line1.boardIndex >= transfer.pointAIndex) continue;

        // Validar distancia de trasbordo
        if (transfer.walkDistance > MAX_WALK_TRANSFER) continue;

        // Validar dirección en línea 2: punto de trasbordo → destino
        if (transfer.pointBIndex >= line2Dest.alightIndex) continue;

        // Validar distancia de caminata al destino
        if (line2Dest.alightDistance > MAX_WALK_DESTINATION) continue;

        const ride1Polyline = line1.polyline.slice(
          line1.boardIndex,
          transfer.pointAIndex + 1,
        );
        const ride2Polyline = line2Dest.polyline.slice(
          transfer.pointBIndex,
          line2Dest.alightIndex + 1,
        );

        const legs: JourneyLeg[] = [];

        if (line1.boardDistance > 0) {
          legs.push({
            type: 'walk',
            from: origin,
            to: line1.boardPoint,
            distance: Math.round(line1.boardDistance),
          });
        }

        legs.push({
          type: 'ride',
          from: line1.boardPoint,
          to: [transfer.pointALng, transfer.pointALat],
          distance: Math.round(this.calculatePolylineDistance(ride1Polyline)),
          lineId: line1.id,
          lineCode: line1.code,
          lineName: line1.name,
          lineColor: line1.color,
          polyline: ride1Polyline,
        });

        if (transfer.walkDistance > 0) {
          legs.push({
            type: 'walk',
            from: [transfer.pointALng, transfer.pointALat],
            to: [transfer.pointBLng, transfer.pointBLat],
            distance: Math.round(transfer.walkDistance),
          });
        }

        legs.push({
          type: 'ride',
          from: [transfer.pointBLng, transfer.pointBLat],
          to: line2Dest.alightPoint,
          distance: Math.round(this.calculatePolylineDistance(ride2Polyline)),
          lineId: line2Dest.id,
          lineCode: line2Dest.code,
          lineName: line2Dest.name,
          lineColor: line2Dest.color,
          polyline: ride2Polyline,
        });

        if (line2Dest.alightDistance > 0) {
          legs.push({
            type: 'walk',
            from: line2Dest.alightPoint,
            to: destination,
            distance: Math.round(line2Dest.alightDistance),
          });
        }

        options.push(this.buildJourneyOption(legs, 1));
      }
    }

    return options;
  }

  // ─── Step 4: Rutas con 2 trasbordos ───────────────────────────────────────

  private async buildTwoTransferRoutes(
    originCandidates: CandidateLine[],
    destCandidateIds: Set<string>,
    destCandidateMap: Map<string, CandidateLine>,
    origin: [number, number],
    destination: [number, number],
  ): Promise<JourneyOption[]> {
    const options: JourneyOption[] = [];

    for (const line1 of originCandidates) {
      const transfers1 = this.getTransfersFrom(line1.id);

      for (const transfer1 of transfers1) {
        // Validar dirección en línea 1
        if (line1.boardIndex >= transfer1.pointAIndex) continue;
        if (transfer1.walkDistance > MAX_WALK_TRANSFER) continue;

        // Cargar línea 2 para obtener su polilínea
        const line2Data = await this.getLineData(transfer1.lineBId);
        if (!line2Data) continue;

        const transfers2 = this.getTransfersFrom(transfer1.lineBId);

        for (const transfer2 of transfers2) {
          // Evitar ciclos
          if (transfer2.lineBId === line1.id) continue;

          // ¿La línea 3 llega al destino?
          if (!destCandidateIds.has(transfer2.lineBId)) continue;

          const line3Dest = destCandidateMap.get(transfer2.lineBId)!;

          // Validar dirección en línea 2: trasbordo1 → trasbordo2
          if (transfer1.pointBIndex >= transfer2.pointAIndex) continue;
          if (transfer2.walkDistance > MAX_WALK_TRANSFER) continue;

          // Validar dirección en línea 3: trasbordo2 → destino
          if (transfer2.pointBIndex >= line3Dest.alightIndex) continue;
          if (line3Dest.alightDistance > MAX_WALK_DESTINATION) continue;

          const ride1Polyline = line1.polyline.slice(
            line1.boardIndex,
            transfer1.pointAIndex + 1,
          );
          const ride2Polyline = line2Data.polyline.slice(
            transfer1.pointBIndex,
            transfer2.pointAIndex + 1,
          );
          const ride3Polyline = line3Dest.polyline.slice(
            transfer2.pointBIndex,
            line3Dest.alightIndex + 1,
          );

          const legs: JourneyLeg[] = [];

          if (line1.boardDistance > 0) {
            legs.push({
              type: 'walk',
              from: origin,
              to: line1.boardPoint,
              distance: Math.round(line1.boardDistance),
            });
          }

          legs.push({
            type: 'ride',
            from: line1.boardPoint,
            to: [transfer1.pointALng, transfer1.pointALat],
            distance: Math.round(this.calculatePolylineDistance(ride1Polyline)),
            lineId: line1.id,
            lineCode: line1.code,
            lineName: line1.name,
            lineColor: line1.color,
            polyline: ride1Polyline,
          });

          if (transfer1.walkDistance > 0) {
            legs.push({
              type: 'walk',
              from: [transfer1.pointALng, transfer1.pointALat],
              to: [transfer1.pointBLng, transfer1.pointBLat],
              distance: Math.round(transfer1.walkDistance),
            });
          }

          legs.push({
            type: 'ride',
            from: [transfer1.pointBLng, transfer1.pointBLat],
            to: [transfer2.pointALng, transfer2.pointALat],
            distance: Math.round(this.calculatePolylineDistance(ride2Polyline)),
            lineId: line2Data.id,
            lineCode: line2Data.code,
            lineName: line2Data.name,
            lineColor: line2Data.color,
            polyline: ride2Polyline,
          });

          if (transfer2.walkDistance > 0) {
            legs.push({
              type: 'walk',
              from: [transfer2.pointALng, transfer2.pointALat],
              to: [transfer2.pointBLng, transfer2.pointBLat],
              distance: Math.round(transfer2.walkDistance),
            });
          }

          legs.push({
            type: 'ride',
            from: [transfer2.pointBLng, transfer2.pointBLat],
            to: line3Dest.alightPoint,
            distance: Math.round(this.calculatePolylineDistance(ride3Polyline)),
            lineId: line3Dest.id,
            lineCode: line3Dest.code,
            lineName: line3Dest.name,
            lineColor: line3Dest.color,
            polyline: ride3Polyline,
          });

          if (line3Dest.alightDistance > 0) {
            legs.push({
              type: 'walk',
              from: line3Dest.alightPoint,
              to: destination,
              distance: Math.round(line3Dest.alightDistance),
            });
          }

          options.push(this.buildJourneyOption(legs, 2));
        }
      }
    }

    return options;
  }

  // ─── Helpers de datos ─────────────────────────────────────────────────────

  private getTransfersFrom(lineId: string): TransferNode[] {
    return this.transferCache.getTransfersFrom(lineId);
  }

  private async getLineData(lineId: string): Promise<{
    id: string;
    code: string;
    name: string;
    color: string;
    polyline: number[][];
  } | null> {
    const rows = await this.dataSource.query(
      `SELECT id, code, name, color, geo_json FROM lines WHERE id = $1`,
      [lineId],
    );

    if (!rows[0]?.geo_json?.coordinates?.[0]) return null;

    return {
      id: rows[0].id,
      code: rows[0].code,
      name: rows[0].name || rows[0].code,
      color: rows[0].color || '#3B82F6',
      polyline: rows[0].geo_json.coordinates[0],
    };
  }

  // ─── Helpers de geometría ─────────────────────────────────────────────────

  private findClosestPoint(
    polyline: number[][],
    target: [number, number],
  ): { point: [number, number]; index: number; distance: number } | null {
    let minDist = Infinity;
    let bestPoint: [number, number] | null = null;
    let bestIndex = -1;

    for (let i = 0; i < polyline.length; i++) {
      const dist = this.haversine(target, polyline[i]);
      if (dist < minDist) {
        minDist = dist;
        bestPoint = [polyline[i][0], polyline[i][1]];
        bestIndex = i;
      }
    }

    if (!bestPoint) return null;
    return { point: bestPoint, index: bestIndex, distance: minDist };
  }

  private calculatePolylineDistance(coords: number[][]): number {
    let distance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      distance += this.haversine(coords[i], coords[i + 1]);
    }
    return distance;
  }

  private haversine(coord1: number[], coord2: number[]): number {
    const R = 6371000;
    const lat1 = (coord1[1] * Math.PI) / 180;
    const lat2 = (coord2[1] * Math.PI) / 180;
    const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const dLng = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ─── Helpers de construcción ──────────────────────────────────────────────

  private buildJourneyOption(
    legs: JourneyLeg[],
    transfers: number,
  ): JourneyOption {
    let totalDistance = 0;
    let totalWalk = 0;
    let estimatedTime = 0;

    for (const leg of legs) {
      totalDistance += leg.distance;
      if (leg.type === 'walk') {
        totalWalk += leg.distance;
        estimatedTime += leg.distance / WALK_SPEED;
      } else {
        estimatedTime += leg.distance / RIDE_SPEED;
      }
    }

    return {
      id: `journey-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      totalDistance: Math.round(totalDistance),
      totalWalk: Math.round(totalWalk),
      estimatedTime: Math.round(estimatedTime),
      transfers,
      legs,
    };
  }

  private rankAndSlice(options: JourneyOption[]): JourneyOption[] {
    return options
      .sort((a, b) => {
        // 1. Tiempo estimado
        if (a.estimatedTime !== b.estimatedTime) {
          return a.estimatedTime - b.estimatedTime;
        }
        // 2. Número de trasbordos
        if (a.transfers !== b.transfers) {
          return a.transfers - b.transfers;
        }
        // 3. Metros caminados
        return a.totalWalk - b.totalWalk;
      })
      .slice(0, MAX_RESULTS);
  }

  // ─── Helpers de parsing ───────────────────────────────────────────────────

  private getOriginFromCandidate(candidate: CandidateLine): [number, number] {
    // El boardPoint ya está en la línea, el origen real es inferido
    // desde la distancia — lo pasamos directamente desde search()
    return candidate.boardPoint;
  }

  private parseCoordinates(str: string): [number, number] {
    const [lat, lng] = str.split(',').map((s) => parseFloat(s.trim()));
    return [lng, lat];
  }
}
