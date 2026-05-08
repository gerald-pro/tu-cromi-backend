import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Command, CommandRunner, Option } from 'nest-commander';
import * as cliProgress from 'cli-progress';
import { Line } from '../modules/lines/line.entity';
import { LineTransfer } from '../modules/transfers/line-transfer.entity';

const TRANSFER_RADIUS_METERS = 300;

interface ComputeTransfersOptions {
  limit?: number;
}

interface CandidatePair {
  lineAId: number;
  lineBId: number;
}

interface LineData {
  id: number;
  polyline: number[][];
}

@Injectable()
@Command({
  name: 'compute-transfers',
  description: 'Precalculates transfer points between transit lines',
})
export class ComputeTransfersCommand extends CommandRunner {
  private readonly logger = new Logger(ComputeTransfersCommand.name);

  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
    @InjectRepository(LineTransfer)
    private readonly transferRepository: Repository<LineTransfer>,
    private readonly dataSource: DataSource,
  ) {
    super();
  }

  async run(
    _passedParams: string[],
    options: ComputeTransfersOptions,
  ): Promise<void> {
    const limit = options.limit;
    console.log('=== ComputeTransfersCommand.run() started ===');
    if (limit) console.log(`=== Limit set: ${limit} ===`);

    await this.enablePostGIS();

    await this.transferRepository.clear();
    console.log('✓ Cleared existing transfers');

    const candidatePairs = await this.findCandidatePairs(limit);
    const lineMap = await this.loadLines();
    console.log(`✓ Loaded ${lineMap.size} lines`);

    const transfers: Partial<LineTransfer>[] = [];

    const progressBar = new cliProgress.SingleBar(
      {
        format:
          'Computing |{bar}| {percentage}% | {value}/{total} pairs | ETA: {eta}s',
        barCompleteChar: '=',
        barIncompleteChar: '-',
        hideCursor: false,
      },

      cliProgress.Presets.rect,
    );

    progressBar.start(candidatePairs.length, 0);

    for (let i = 0; i < candidatePairs.length; i++) {
      const pair = candidatePairs[i];
      const lineA = lineMap.get(pair.lineAId);
      const lineB = lineMap.get(pair.lineBId);

      if (lineA && lineB) {
        const newTransfers = this.findAllTransferPoints(lineA, lineB);
        transfers.push(...newTransfers);
      }

      progressBar.increment();
    }

    progressBar.stop();

    console.log(`✓ Computed ${transfers.length} valid transfer points`);

    await this.saveBatched(transfers);

    console.log('✓ Transfer computation complete');
  }

  @Option({
    flags: '-l, --limit <number>',
    description: 'Limit the number of candidate pairs to process',
  })
  parseLimit(val: string): number {
    return parseInt(val, 10);
  }

  private async enablePostGIS(): Promise<void> {
    await this.dataSource.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    console.log('✓ PostGIS enabled');
  }

  private async findCandidatePairs(limit?: number): Promise<CandidatePair[]> {
    const spinner = ['|', '/', '-', '\\'];
    let spinnerIndex = 0;
    const spinnerInterval = setInterval(() => {
      process.stdout.write(
        `\r${spinner[spinnerIndex]} Searching for nearby line pairs...`,
      );
      spinnerIndex = (spinnerIndex + 1) % spinner.length;
    }, 100);

    let query = `
    SELECT DISTINCT a.id AS line_a_id, b.id AS line_b_id
    FROM lines a
    JOIN lines b ON a.id <> b.id
    WHERE ST_DWithin(
      a.geom::geography,
      b.geom::geography,
      $1
    )
    AND a.id < b.id
  `;
    if (limit) {
      query += ` LIMIT ${limit}`;
    }

    try {
      const rows: { line_a_id: string; line_b_id: string }[] =
        await this.dataSource.query(query, [TRANSFER_RADIUS_METERS]);

      clearInterval(spinnerInterval);
      process.stdout.write('\r');
      console.log(`✓ Found ${rows.length} nearby line pairs`);

      return rows.map((r) => ({
        lineAId: parseInt(r.line_a_id, 10),
        lineBId: parseInt(r.line_b_id, 10),
      }));
    } catch (err) {
      clearInterval(spinnerInterval);
      process.stdout.write('\r');
      throw err;
    }
  }

  private async loadLines(): Promise<Map<number, LineData>> {
    const lines = await this.lineRepository.find();
    const map = new Map<number, LineData>();

    for (const line of lines) {
      const geoJson = line.geoJson as {
        type: string;
        coordinates: number[][][];
      };
      if (!geoJson?.coordinates?.[0]) continue;
      map.set(line.id, { id: line.id, polyline: geoJson.coordinates[0] });
    }

    return map;
  }

  private findAllTransferPoints(
    lineA: LineData,
    lineB: LineData,
  ): Partial<LineTransfer>[] {
    const forwardResults: Partial<LineTransfer>[] = [];

    for (let i = 0; i < lineA.polyline.length; i++) {
      const pA = lineA.polyline[i];
      let localMin = Infinity;
      let localBest: {
        i: number;
        j: number;
        dist: number;
        pB: number[];
      } | null = null;

      for (let j = 0; j < lineB.polyline.length; j++) {
        const pB = lineB.polyline[j];
        const dist = this.haversine(pA, pB);

        if (dist <= TRANSFER_RADIUS_METERS && dist < localMin) {
          localMin = dist;
          localBest = { i, j, dist, pB };
        }
      }

      if (localBest) {
        const { i: ai, j: bj, dist, pB } = localBest;
        forwardResults.push({
          lineAId: lineA.id,
          lineBId: lineB.id,
          pointALng: pA[0],
          pointALat: pA[1],
          pointAIndex: ai,
          pointBLng: pB[0],
          pointBLat: pB[1],
          pointBIndex: bj,
          walkDistance: Math.round(dist),
        });
      }
    }

    // Deduplicar solo los forward primero
    const dedupedForward = this.deduplicateNearby(forwardResults);

    // Generar inversos a partir de los forward ya deduplicados
    // Así cada inverso tiene el mejor punto garantizado
    const inverseResults: Partial<LineTransfer>[] = dedupedForward.map((t) => ({
      lineAId: t.lineBId,
      lineBId: t.lineAId,
      pointALng: t.pointBLng,
      pointALat: t.pointBLat,
      pointAIndex: t.pointBIndex,
      pointBLng: t.pointALng,
      pointBLat: t.pointALat,
      pointBIndex: t.pointAIndex,
      walkDistance: t.walkDistance,
    }));

    // Deduplicar inversos también (puede haber redundancia desde distintos forward)
    const dedupedInverse = this.deduplicateNearby(inverseResults);

    return [...dedupedForward, ...dedupedInverse];
  }

  private deduplicateNearby(
    transfers: Partial<LineTransfer>[],
    minSeparationMeters = 100,
  ): Partial<LineTransfer>[] {
    // Separar por dirección antes de deduplicar
    // para no comparar A→B contra B→A
    const groups = new Map<string, Partial<LineTransfer>[]>();

    for (const t of transfers) {
      const key = `${t.lineAId}→${t.lineBId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    const result: Partial<LineTransfer>[] = [];

    for (const group of groups.values()) {
      const dedupedGroup: Partial<LineTransfer>[] = [];

      for (const candidate of group) {
        const tooClose = dedupedGroup.some((existing) => {
          const distA = this.haversine(
            [existing.pointALng!, existing.pointALat!],
            [candidate.pointALng!, candidate.pointALat!],
          );
          const distB = this.haversine(
            [existing.pointBLng!, existing.pointBLat!],
            [candidate.pointBLng!, candidate.pointBLat!],
          );
          // Duplicado solo si AMBOS puntos están cerca
          return distA < minSeparationMeters && distB < minSeparationMeters;
        });

        if (!tooClose) dedupedGroup.push(candidate);
      }

      result.push(...dedupedGroup);
    }

    return result;
  }

  private async saveBatched(
    transfers: Partial<LineTransfer>[],
    batchSize = 500,
  ): Promise<void> {
    const total = transfers.length;
    for (let i = 0; i < total; i += batchSize) {
      const batch = transfers.slice(i, i + batchSize);
      await this.transferRepository.save(batch);
      process.stdout.write(
        `\rSaved ${Math.min(i + batchSize, total)}/${total}`,
      );
    }
    process.stdout.write('\n'); // Nueva línea al final
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
}
