import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Line } from '../lines/line.entity';
import { SearchRouteDto } from './dto';

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
  legs: JourneyLeg[];
}

interface LineInfo {
  id: string;
  code: string;
  name: string;
  color: string;
  polyline: number[][];
}

interface PointOnLine {
  point: [number, number];
  index: number;
  distance: number;
}

const WALK_SPEED = 50;
const RIDE_SPEED = 250;
const MAX_WALK_SEGMENT = 500;
const TRANSFER_DISTANCE = 200;

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async search(dto: SearchRouteDto): Promise<{ options: JourneyOption[] }> {
    const originCoords = this.parseCoordinates(dto.origin);
    const destCoords = this.parseCoordinates(dto.destination);

    const lines = await this.lineRepository.find();
    const lineInfos: LineInfo[] = lines
      .map((line) => {
        const geoJson = line.geoJson as {
          type: string;
          coordinates: number[][][];
        };
        if (!geoJson?.coordinates) return null;
        return geoJson.coordinates.map((polyline) => ({
          id: line.id,
          code: line.code,
          name: line.name || line.code,
          color: line.color || '#3B82F6',
          polyline,
        }));
      })
      .flat()
      .filter((l): l is LineInfo => l !== null);

    const options: JourneyOption[] = [];

    for (const lineInfo of lineInfos) {
      const direct = this.findDirectRoute(lineInfo, originCoords, destCoords);
      if (direct) options.push(direct);
    }

    for (let i = 0; i < lineInfos.length; i++) {
      for (let j = 0; j < lineInfos.length; j++) {
        if (i === j) continue;
        const transfer = this.findTransferRoute(
          lineInfos[i],
          lineInfos[j],
          originCoords,
          destCoords,
        );
        if (transfer) options.push(transfer);
      }
    }

    for (let i = 0; i < lineInfos.length; i++) {
      for (let j = 0; j < lineInfos.length; j++) {
        if (i === j) continue;
        for (let k = 0; k < lineInfos.length; k++) {
          if (i === k || j === k) continue;
          const doubleTransfer = this.findDoubleTransferRoute(
            lineInfos[i],
            lineInfos[j],
            lineInfos[k],
            originCoords,
            destCoords,
          );
          if (doubleTransfer) options.push(doubleTransfer);
        }
      }
    }

    options.sort((a, b) => a.estimatedTime - b.estimatedTime);
    const topOptions = options.slice(0, 5);

    return { options: topOptions };
  }

  private findDirectRoute(
    lineInfo: LineInfo,
    origin: [number, number],
    dest: [number, number],
  ): JourneyOption | null {
    const board = this.findBestPointOnLine(lineInfo.polyline, origin);
    const alight = this.findBestPointOnLine(lineInfo.polyline, dest);

    if (!board || !alight) return null;
    if (board.distance > MAX_WALK_SEGMENT || alight.distance > MAX_WALK_SEGMENT) {
      return null;
    }

    const startIdx = Math.min(board.index, alight.index);
    const endIdx = Math.max(board.index, alight.index);
    const ridePolyline = lineInfo.polyline.slice(startIdx, endIdx + 1);
    const rideDistance = this.calculatePolylineDistance(ridePolyline);

    const legs: JourneyLeg[] = [];

    if (board.distance > 0) {
      legs.push({
        type: 'walk',
        from: origin,
        to: board.point,
        distance: Math.round(board.distance),
      });
    }

    legs.push({
      type: 'ride',
      from: board.point,
      to: alight.point,
      distance: Math.round(rideDistance),
      lineId: lineInfo.id,
      lineCode: lineInfo.code,
      lineName: lineInfo.name,
      lineColor: lineInfo.color,
      polyline: ridePolyline,
    });

    if (alight.distance > 0) {
      legs.push({
        type: 'walk',
        from: alight.point,
        to: dest,
        distance: Math.round(alight.distance),
      });
    }

    return this.buildJourneyOption(legs);
  }

  private findTransferRoute(
    line1: LineInfo,
    line2: LineInfo,
    origin: [number, number],
    dest: [number, number],
  ): JourneyOption | null {
    const board = this.findBestPointOnLine(line1.polyline, origin);
    if (!board || board.distance > MAX_WALK_SEGMENT) return null;

    const alight = this.findBestPointOnLine(line1.polyline, dest);
    if (!alight || alight.distance > MAX_WALK_SEGMENT) return null;

    const transferPoint = this.findTransferPoint(
      line1.polyline,
      line2.polyline,
      board.point,
      alight.point,
    );
    if (!transferPoint) return null;

    const boardIdx = Math.min(board.index, alight.index);
    const transferIdx = this.findClosestPointIndex(line1.polyline, transferPoint);
    const ride1Polyline = line1.polyline.slice(boardIdx, transferIdx + 1);
    const ride1Distance = this.calculatePolylineDistance(ride1Polyline);

    const transferOnLine2 = this.findBestPointOnLine(line2.polyline, transferPoint);
    if (!transferOnLine2 || transferOnLine2.distance > MAX_WALK_SEGMENT) return null;

    const destOnLine2 = this.findBestPointOnLine(line2.polyline, dest);
    if (!destOnLine2 || destOnLine2.distance > MAX_WALK_SEGMENT) return null;

    const startIdx2 = Math.min(transferOnLine2.index, destOnLine2.index);
    const endIdx2 = Math.max(transferOnLine2.index, destOnLine2.index);
    const ride2Polyline = line2.polyline.slice(startIdx2, endIdx2 + 1);
    const ride2Distance = this.calculatePolylineDistance(ride2Polyline);

    const legs: JourneyLeg[] = [];

    if (board.distance > 0) {
      legs.push({
        type: 'walk',
        from: origin,
        to: board.point,
        distance: Math.round(board.distance),
      });
    }

    legs.push({
      type: 'ride',
      from: board.point,
      to: transferPoint,
      distance: Math.round(ride1Distance),
      lineId: line1.id,
      lineCode: line1.code,
      lineName: line1.name,
      lineColor: line1.color,
      polyline: ride1Polyline,
    });

    legs.push({
      type: 'walk',
      from: transferPoint,
      to: transferOnLine2.point,
      distance: Math.round(transferOnLine2.distance),
    });

    legs.push({
      type: 'ride',
      from: transferOnLine2.point,
      to: destOnLine2.point,
      distance: Math.round(ride2Distance),
      lineId: line2.id,
      lineCode: line2.code,
      lineName: line2.name,
      lineColor: line2.color,
      polyline: ride2Polyline,
    });

    if (destOnLine2.distance > 0) {
      legs.push({
        type: 'walk',
        from: destOnLine2.point,
        to: dest,
        distance: Math.round(destOnLine2.distance),
      });
    }

    return this.buildJourneyOption(legs);
  }

  private findDoubleTransferRoute(
    line1: LineInfo,
    line2: LineInfo,
    line3: LineInfo,
    origin: [number, number],
    dest: [number, number],
  ): JourneyOption | null {
    const board = this.findBestPointOnLine(line1.polyline, origin);
    if (!board || board.distance > MAX_WALK_SEGMENT) return null;

    const alight = this.findBestPointOnLine(line1.polyline, dest);
    if (!alight || alight.distance > MAX_WALK_SEGMENT) return null;

    const transfer1Point = this.findTransferPoint(
      line1.polyline,
      line2.polyline,
      board.point,
      alight.point,
    );
    if (!transfer1Point) return null;

    const transfer1OnLine2 = this.findBestPointOnLine(
      line2.polyline,
      transfer1Point,
    );
    if (
      !transfer1OnLine2 ||
      transfer1OnLine2.distance > MAX_WALK_SEGMENT
    )
      return null;

    const transfer2Point = this.findTransferPoint(
      line2.polyline,
      line3.polyline,
      transfer1OnLine2.point,
      alight.point,
    );
    if (!transfer2Point) return null;

    const transfer2OnLine3 = this.findBestPointOnLine(
      line3.polyline,
      transfer2Point,
    );
    if (!transfer2OnLine3 || transfer2OnLine3.distance > MAX_WALK_SEGMENT) {
      return null;
    }

    const destOnLine3 = this.findBestPointOnLine(line3.polyline, dest);
    if (!destOnLine3 || destOnLine3.distance > MAX_WALK_SEGMENT) return null;

    const legs: JourneyLeg[] = [];

    if (board.distance > 0) {
      legs.push({
        type: 'walk',
        from: origin,
        to: board.point,
        distance: Math.round(board.distance),
      });
    }

    const idx1Start = Math.min(board.index, this.findClosestPointIndex(line1.polyline, transfer1Point));
    const idx1End = this.findClosestPointIndex(line1.polyline, transfer1Point);
    const ride1Polyline = line1.polyline.slice(idx1Start, idx1End + 1);
    const ride1Distance = this.calculatePolylineDistance(ride1Polyline);

    legs.push({
      type: 'ride',
      from: board.point,
      to: transfer1Point,
      distance: Math.round(ride1Distance),
      lineId: line1.id,
      lineCode: line1.code,
      lineName: line1.name,
      lineColor: line1.color,
      polyline: ride1Polyline,
    });

    legs.push({
      type: 'walk',
      from: transfer1Point,
      to: transfer1OnLine2.point,
      distance: Math.round(transfer1OnLine2.distance),
    });

    const idx2Start = Math.min(
      transfer1OnLine2.index,
      this.findClosestPointIndex(line2.polyline, transfer2Point),
    );
    const idx2End = this.findClosestPointIndex(line2.polyline, transfer2Point);
    const ride2Polyline = line2.polyline.slice(idx2Start, idx2End + 1);
    const ride2Distance = this.calculatePolylineDistance(ride2Polyline);

    legs.push({
      type: 'ride',
      from: transfer1OnLine2.point,
      to: transfer2Point,
      distance: Math.round(ride2Distance),
      lineId: line2.id,
      lineCode: line2.code,
      lineName: line2.name,
      lineColor: line2.color,
      polyline: ride2Polyline,
    });

    legs.push({
      type: 'walk',
      from: transfer2Point,
      to: transfer2OnLine3.point,
      distance: Math.round(transfer2OnLine3.distance),
    });

    const idx3Start = Math.min(
      transfer2OnLine3.index,
      destOnLine3.index,
    );
    const idx3End = Math.max(transfer2OnLine3.index, destOnLine3.index);
    const ride3Polyline = line3.polyline.slice(idx3Start, idx3End + 1);
    const ride3Distance = this.calculatePolylineDistance(ride3Polyline);

    legs.push({
      type: 'ride',
      from: transfer2OnLine3.point,
      to: destOnLine3.point,
      distance: Math.round(ride3Distance),
      lineId: line3.id,
      lineCode: line3.code,
      lineName: line3.name,
      lineColor: line3.color,
      polyline: ride3Polyline,
    });

    if (destOnLine3.distance > 0) {
      legs.push({
        type: 'walk',
        from: destOnLine3.point,
        to: dest,
        distance: Math.round(destOnLine3.distance),
      });
    }

    return this.buildJourneyOption(legs);
  }

  private findBestPointOnLine(
    polyline: number[][],
    target: [number, number],
  ): PointOnLine | null {
    let minDist = Infinity;
    let bestPoint: [number, number] | null = null;
    let bestIndex = -1;

    for (let i = 0; i < polyline.length; i++) {
      const dist = this.haversineDistance(target, polyline[i]);
      if (dist < minDist) {
        minDist = dist;
        bestPoint = [polyline[i][0], polyline[i][1]];
        bestIndex = i;
      }
    }

    if (!bestPoint) return null;
    return { point: bestPoint, index: bestIndex, distance: minDist };
  }

  private findTransferPoint(
    polyline1: number[][],
    polyline2: number[][],
    start: [number, number],
    end: [number, number],
  ): [number, number] | null {
    let minDist = Infinity;
    let bestPoint: [number, number] | null = null;

    const startIdx = this.findClosestPointIndex(polyline1, start);
    const endIdx = this.findClosestPointIndex(polyline1, end);
    const minIdx = Math.min(startIdx, endIdx);
    const maxIdx = Math.max(startIdx, endIdx);

    for (let i = minIdx; i <= maxIdx; i++) {
      for (const p2 of polyline2) {
        const dist = this.haversineDistance(polyline1[i], p2);
        if (dist < minDist && dist <= TRANSFER_DISTANCE) {
          minDist = dist;
          bestPoint = [p2[0], p2[1]];
        }
      }
    }

    return bestPoint;
  }

  private findClosestPointIndex(
    polyline: number[][],
    point: [number, number],
  ): number {
    let minDist = Infinity;
    let index = 0;

    for (let i = 0; i < polyline.length; i++) {
      const dist = this.haversineDistance(point, polyline[i]);
      if (dist < minDist) {
        minDist = dist;
        index = i;
      }
    }

    return index;
  }

  private buildJourneyOption(legs: JourneyLeg[]): JourneyOption {
    let totalDistance = 0;
    let totalWalk = 0;
    let rideTime = 0;
    let walkTime = 0;

    for (const leg of legs) {
      totalDistance += leg.distance;
      if (leg.type === 'walk') {
        totalWalk += leg.distance;
        walkTime += leg.distance / WALK_SPEED;
      } else {
        rideTime += leg.distance / RIDE_SPEED;
      }
    }

    return {
      id: `journey-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      totalDistance: Math.round(totalDistance),
      totalWalk: Math.round(totalWalk),
      estimatedTime: Math.round(walkTime + rideTime),
      legs,
    };
  }

  private haversineDistance(coord1: number[], coord2: number[]): number {
    const R = 6371000;
    const lat1 = (coord1[1] * Math.PI) / 180;
    const lat2 = (coord2[1] * Math.PI) / 180;
    const dLat = ((coord2[1] - coord1[1]) * Math.PI) / 180;
    const dLng = ((coord2[0] - coord1[0]) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private calculatePolylineDistance(coords: number[][]): number {
    let distance = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      distance += this.haversineDistance(coords[i], coords[i + 1]);
    }
    return distance;
  }

  private parseCoordinates(str: string): [number, number] {
    const [lat, lng] = str.split(',').map((s) => parseFloat(s.trim()));
    return [lng, lat];
  }
}
