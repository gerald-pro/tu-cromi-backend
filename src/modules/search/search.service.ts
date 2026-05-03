import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Line } from '../lines/line.entity';
import { LineTransfer } from '../transfers/line-transfer.entity';
import { TransferCacheService } from '../transfers/transfer-cache.service';
import { SearchRouteDto } from './dto';

// ─── Umbrales ────────────────────────────────────────────────────────────────

const MAX_WALK_ORIGIN = 400;
const MAX_WALK_DESTINATION = 400;
const MAX_WALK_TRANSFER = 300;
const WALK_SPEED = 50; // metros por minuto
const RIDE_SPEED = 250; // metros por minuto
const MAX_RESULTS = 10;
const IMPROVEMENT_THRESHOLD_PERCENT = 0.1;
const IMPROVEMENT_THRESHOLD_MIN = 60; // 1 minuto en segundos

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

interface TransferNode {
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

interface LineRow {
  id: string;
  code: string;
  name: string;
  color: string;
  geo_json: { type: string; coordinates: number[][][] };
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
    @InjectRepository(LineTransfer)
    private readonly transferRepository: Repository<LineTransfer>,
    private readonly transferCache: TransferCacheService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Entry point ───────────────────────────────────────────────────────────

  async search(dto: SearchRouteDto): Promise<JourneyOption[]> {
    const origin = this.parseCoordinates(dto.origin);
    const destination = this.parseCoordinates(dto.destination);
    const includePolylines = dto.includePolylines !== false;

    console.log('=== SEARCH DEBUG ===');
    console.log('Origin:', origin);
    console.log('Destination:', destination);

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
      return [];
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
      includePolylines,
    );
    options.push(...directRoutes);

    // 3. Rutas con 1 trasbordo
    const oneTransferRoutes = this.buildOneTransferRoutes(
      originCandidates,
      destCandidateIds,
      destCandidateMap,
      origin,
      destination,
      includePolylines,
    );
    options.push(...oneTransferRoutes);

    // 4. Rutas con 2 trasbordos
    const twoTransferRoutes = this.buildTwoTransferRoutes(
      originCandidates,
      destCandidateIds,
      destCandidateMap,
      origin,
      destination,
      includePolylines,
    );
    options.push(...twoTransferRoutes);

    // 5. Ranking y retorno
    const results = this.rankAndSlice(options);
    console.log('=== RESULTS ===');
    console.log(`Total options before filtering: ${options.length}`);
    console.log(
      `Direct routes: ${options.filter((o) => o.transfers === 0).length}`,
    );
    console.log(
      `1-transfer routes: ${options.filter((o) => o.transfers === 1).length}`,
    );
    console.log(
      `2-transfer routes: ${options.filter((o) => o.transfers === 2).length}`,
    );
    console.log(`Final results after ranking: ${results.length}`);
    return results;
  }

  // ─── Step 1: Filtrado geográfico ───────────────────────────────────────────

  private async findCandidateLines(
    near: [number, number],
    target: [number, number],
    radiusMeters: number,
  ): Promise<CandidateLine[]> {
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

    console.log(
      `[CANDIDATES] Found ${rows.length} lines within ${radiusMeters}m of point [${near[0]}, ${near[1]}]`,
    );

    const candidates: CandidateLine[] = [];

    for (const row of rows) {
      if (!row.geo_json?.coordinates?.[0]) continue;
      const polyline = row.geo_json.coordinates[0];

      const boardResult = this.findClosestPoint(polyline, near);
      const alightResult = this.findClosestPoint(polyline, target);

      if (!boardResult || !alightResult) continue;
      if (boardResult.distance > radiusMeters) {
        console.log(
          `[CANDIDATES] Line ${row.code}: board distance ${Math.round(boardResult.distance)}m > ${radiusMeters}m, skipping`,
        );
        continue;
      }

      console.log(
        `[CANDIDATES] Line ${row.code}: boardIndex=${boardResult.index} (${Math.round(boardResult.distance)}m), alightIndex=${alightResult.index} (${Math.round(alightResult.distance)}m)`,
      );

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
    includePolylines: boolean,
  ): JourneyOption[] {
    const options: JourneyOption[] = [];

    console.log('=== DIRECT ROUTES DEBUG ===');
    console.log(
      'Origin candidates:',
      originCandidates.map((c) => ({
        id: c.id,
        code: c.code,
        boardIndex: c.boardIndex,
        boardDistance: Math.round(c.boardDistance),
        alightIndex: c.alightIndex,
        alightDistance: Math.round(c.alightDistance),
      })),
    );
    console.log(
      'Destination candidates:',
      Array.from(destCandidateMap.values()).map((c) => ({
        id: c.id,
        code: c.code,
        boardIndex: c.boardIndex,
        boardDistance: Math.round(c.boardDistance),
        alightIndex: c.alightIndex,
        alightDistance: Math.round(c.alightDistance),
      })),
    );

    for (const originLine of originCandidates) {
      // La línea debe aparecer también en los candidatos de destino
      if (!destCandidateIds.has(originLine.id)) {
        console.log(
          `[SKIP] Line ${originLine.code} (${originLine.id}): not in destination candidates`,
        );
        continue;
      }

      const destLine = destCandidateMap.get(originLine.id)!;

      console.log(
        `[CHECK] Line ${originLine.code}: originLine.boardIndex=${originLine.boardIndex}, destLine.boardIndex=${destLine.boardIndex}, originLine.alightIndex=${originLine.alightIndex}, destLine.alightIndex=${destLine.alightIndex}`,
      );

      // Determinar dirección real de viaje
      const goingForward = originLine.boardIndex < originLine.alightIndex;

      // Validar que destino esté después del origen en dirección de viaje
      if (goingForward) {
        if (originLine.boardIndex >= destLine.boardIndex) {
          console.log(
            `[FILTERED] Line ${originLine.code}: direction check failed (${originLine.boardIndex} >= ${destLine.boardIndex})`,
          );
          continue;
        }
      } else {
        if (originLine.boardIndex <= destLine.boardIndex) {
          console.log(
            `[FILTERED] Line ${originLine.code}: direction check failed (${originLine.boardIndex} <= ${destLine.boardIndex})`,
          );
          continue;
        }
      }

      // Validar distancia de caminata al destino
      if (destLine.boardDistance > MAX_WALK_DESTINATION) {
        console.log(
          `[FILTERED] Line ${originLine.code}: destination walk too far (${Math.round(destLine.boardDistance)}m > ${MAX_WALK_DESTINATION}m)`,
        );
        continue;
      }

      console.log(`[ACCEPTED] Line ${originLine.code}: direct route accepted`);

      // Slice correcto según dirección
      const ridePolyline = goingForward
        ? originLine.polyline.slice(
            originLine.boardIndex,
            destLine.boardIndex + 1,
          )
        : originLine.polyline
            .slice(destLine.boardIndex, originLine.boardIndex + 1)
            .reverse();
      const rideDistance = this.calculatePolylineDistance(ridePolyline);

      const legs: JourneyLeg[] = [];

      if (originLine.boardDistance > 0) {
        legs.push({
          type: 'walk',
          from: origin,
          to: originLine.boardPoint,
          distance: Math.round(originLine.boardDistance),
        });
      }

      legs.push({
        type: 'ride',
        from: originLine.boardPoint,
        to: destLine.boardPoint,
        distance: Math.round(rideDistance),
        lineId: originLine.id,
        lineCode: originLine.code,
        lineName: originLine.name,
        lineColor: originLine.color,
        ...(includePolylines && { polyline: ridePolyline }),
      });

      if (destLine.boardDistance > 0) {
        legs.push({
          type: 'walk',
          from: destLine.boardPoint,
          to: destination,
          distance: Math.round(destLine.boardDistance),
        });
      }

      options.push(this.buildJourneyOption(legs, 0));
    }

    return options;
  }

  // ─── Step 3: Rutas con 1 trasbordo ────────────────────────────────────────

  private buildOneTransferRoutes(
    originCandidates: CandidateLine[],
    destCandidateIds: Set<string>,
    destCandidateMap: Map<string, CandidateLine>,
    origin: [number, number],
    destination: [number, number],
    includePolylines: boolean,
  ): JourneyOption[] {
    const options: JourneyOption[] = [];

    for (const line1 of originCandidates) {
      // Consultar transfers desde línea 1
      const transfers = this.getTransfersFrom(line1.id);

      for (const transfer of transfers) {
        // ¿La línea 2 llega al destino?
        if (!destCandidateIds.has(transfer.lineBId)) continue;

        const line2Dest = destCandidateMap.get(transfer.lineBId)!;

        // Evitar transfers a la misma línea (mismo código, distinto sentido)
        if (line2Dest.code === line1.code) continue;

        // Validar dirección en línea 1: abordaje → punto de trasbordo
        const line1GoingForward = line1.boardIndex < line1.alightIndex;
        if (line1GoingForward) {
          if (line1.boardIndex >= transfer.pointAIndex) continue;
        } else {
          if (line1.boardIndex <= transfer.pointAIndex) continue;
        }

        // Validar distancia de trasbordo
        if (transfer.walkDistance > MAX_WALK_TRANSFER) continue;

        // Validar dirección en línea 2: punto de trasbordo → destino
        const line2GoingForward = transfer.pointBIndex < line2Dest.boardIndex;
        if (line2GoingForward) {
          if (transfer.pointBIndex >= line2Dest.boardIndex) continue;
        } else {
          if (transfer.pointBIndex <= line2Dest.boardIndex) continue;
        }

        // Validar distancia de caminata al destino
        if (line2Dest.boardDistance > MAX_WALK_DESTINATION) continue;

        const ride1Polyline = line1GoingForward
          ? line1.polyline.slice(line1.boardIndex, transfer.pointAIndex + 1)
          : line1.polyline
              .slice(transfer.pointAIndex, line1.boardIndex + 1)
              .reverse();
        const ride2Polyline = line2GoingForward
          ? line2Dest.polyline.slice(
              transfer.pointBIndex,
              line2Dest.boardIndex + 1,
            )
          : line2Dest.polyline
              .slice(line2Dest.boardIndex, transfer.pointBIndex + 1)
              .reverse();

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
          ...(includePolylines && { polyline: ride1Polyline }),
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
          to: line2Dest.boardPoint,
          distance: Math.round(this.calculatePolylineDistance(ride2Polyline)),
          lineId: line2Dest.id,
          lineCode: line2Dest.code,
          lineName: line2Dest.name,
          lineColor: line2Dest.color,
          ...(includePolylines && { polyline: ride2Polyline }),
        });

        if (line2Dest.boardDistance > 0) {
          legs.push({
            type: 'walk',
            from: line2Dest.boardPoint,
            to: destination,
            distance: Math.round(line2Dest.boardDistance),
          });
        }

        options.push(this.buildJourneyOption(legs, 1));
      }
    }

    return options;
  }

  // ─── Step 4: Rutas con 2 trasbordos ───────────────────────────────────────

  private buildTwoTransferRoutes(
    originCandidates: CandidateLine[],
    destCandidateIds: Set<string>,
    destCandidateMap: Map<string, CandidateLine>,
    origin: [number, number],
    destination: [number, number],
    includePolylines: boolean,
  ): JourneyOption[] {
    const options: JourneyOption[] = [];

    for (const line1 of originCandidates) {
      const transfers1 = this.getTransfersFrom(line1.id);

      for (const transfer1 of transfers1) {
        // Validar dirección en línea 1
        const line1GoingForward = line1.boardIndex < line1.alightIndex;
        if (line1GoingForward) {
          if (line1.boardIndex >= transfer1.pointAIndex) continue;
        } else {
          if (line1.boardIndex <= transfer1.pointAIndex) continue;
        }
        if (transfer1.walkDistance > MAX_WALK_TRANSFER) continue;

        // Cargar línea 2 para obtener su polilínea
        const line2Data = this.getLineData(transfer1.lineBId);
        if (!line2Data) continue;

        // Evitar transfers a la misma línea (mismo código)
        if (line2Data.code === line1.code) continue;

        const transfers2 = this.getTransfersFrom(transfer1.lineBId);

        for (const transfer2 of transfers2) {
          // Evitar ciclos
          if (transfer2.lineBId === line1.id) continue;

          // ¿La línea 3 llega al destino?
          if (!destCandidateIds.has(transfer2.lineBId)) continue;

          const line3Dest = destCandidateMap.get(transfer2.lineBId)!;

          // Evitar transfers a la misma línea (mismo código)
          if (line3Dest.code === line2Data.code) continue;

          // Validar dirección en línea 2: trasbordo1 → trasbordo2
          const line2GoingForward =
            transfer1.pointBIndex < transfer2.pointAIndex;
          if (line2GoingForward) {
            if (transfer1.pointBIndex >= transfer2.pointAIndex) continue;
          } else {
            if (transfer1.pointBIndex <= transfer2.pointAIndex) continue;
          }
          if (transfer2.walkDistance > MAX_WALK_TRANSFER) continue;

          // Validar dirección en línea 3: trasbordo2 → destino
          const line3GoingForward =
            transfer2.pointBIndex < line3Dest.boardIndex;
          if (line3GoingForward) {
            if (transfer2.pointBIndex >= line3Dest.boardIndex) continue;
          } else {
            if (transfer2.pointBIndex <= line3Dest.boardIndex) continue;
          }
          if (line3Dest.boardDistance > MAX_WALK_DESTINATION) continue;

          const ride1Polyline = line1GoingForward
            ? line1.polyline.slice(line1.boardIndex, transfer1.pointAIndex + 1)
            : line1.polyline
                .slice(transfer1.pointAIndex, line1.boardIndex + 1)
                .reverse();
          const ride2Polyline = line2GoingForward
            ? line2Data.polyline.slice(
                transfer1.pointBIndex,
                transfer2.pointAIndex + 1,
              )
            : line2Data.polyline
                .slice(transfer2.pointAIndex, transfer1.pointBIndex + 1)
                .reverse();
          const ride3Polyline = line3GoingForward
            ? line3Dest.polyline.slice(
                transfer2.pointBIndex,
                line3Dest.boardIndex + 1,
              )
            : line3Dest.polyline
                .slice(line3Dest.boardIndex, transfer2.pointBIndex + 1)
                .reverse();

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
            ...(includePolylines && { polyline: ride1Polyline }),
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
            ...(includePolylines && { polyline: ride2Polyline }),
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
            to: line3Dest.boardPoint,
            distance: Math.round(this.calculatePolylineDistance(ride3Polyline)),
            lineId: line3Dest.id,
            lineCode: line3Dest.code,
            lineName: line3Dest.name,
            lineColor: line3Dest.color,
            ...(includePolylines && { polyline: ride3Polyline }),
          });

          if (line3Dest.boardDistance > 0) {
            legs.push({
              type: 'walk',
              from: line3Dest.boardPoint,
              to: destination,
              distance: Math.round(line3Dest.boardDistance),
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

  private getLineData(lineId: string): {
    id: string;
    code: string;
    name: string;
    color: string;
    polyline: number[][];
  } | null {
    const line = this.transferCache.getLineCache().get(lineId);
    return line ?? null;
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
    const seen = new Set<string>();

    const bestDirectTime = options
      .filter((o) => o.transfers === 0)
      .reduce((min, o) => Math.min(min, o.estimatedTime), Infinity);

    const filtered = options.filter((option) => {
      if (option.transfers > 0 && bestDirectTime < Infinity) {
        const improvementNeeded = Math.min(
          bestDirectTime * IMPROVEMENT_THRESHOLD_PERCENT,
          IMPROVEMENT_THRESHOLD_MIN,
        );
        if (option.estimatedTime >= bestDirectTime - improvementNeeded) {
          return false;
        }
      }

      const fingerprint = option.legs
        .filter((l) => l.type === 'ride')
        .map((l) => l.lineCode)
        .join('→');

      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });

    return filtered
      .sort((a, b) => {
        if (a.estimatedTime !== b.estimatedTime)
          return a.estimatedTime - b.estimatedTime;
        if (a.transfers !== b.transfers) return a.transfers - b.transfers;
        return a.totalWalk - b.totalWalk;
      })
      .slice(0, MAX_RESULTS);
  }

  // ─── Helpers de parsing ───────────────────────────────────────────────────

  private parseCoordinates(str: string): [number, number] {
    const [lat, lng] = str.split(',').map((s) => parseFloat(s.trim()));
    return [lng, lat];
  }
}
