import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Line } from '../modules/lines/line.entity';
import { LineTransfer } from '../modules/transfers/line-transfer.entity';
import { Favorite } from '../modules/favorites/favorite.entity';
import { Review } from '../modules/reviews/review.entity';
import { User } from '../modules/users/user.entity';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const TRANSFER_RADIUS_METERS = 300;
const BATCH_SIZE = 500;
const MIN_SEPARATION_METERS = 100;

interface LineData {
  id: number;
  polyline: number[][];
}

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'tucromi',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  entities: [Line, LineTransfer, Favorite, Review, User],
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
});

async function computeTransfers(): Promise<void> {
  await dataSource.initialize();
  console.log('Database connected');

  const lineRepository = dataSource.getRepository(Line);
  const transferRepository = dataSource.getRepository(LineTransfer);

  await dataSource.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
  console.log('PostGIS enabled');

  const lineCount = await lineRepository.count();
  console.log(`Lines found: ${lineCount}`);

  const existingTransfers = await transferRepository.count();
  if (existingTransfers > 0) {
    await transferRepository.clear();
    console.log(`Cleared ${existingTransfers} existing transfers`);
  }

  const lines = await lineRepository.find();
  const lineMap = new Map<number, LineData>();
  for (const line of lines) {
    const geoJson = line.geoJson as {
      type: string;
      coordinates: number[][][];
    };
    if (!geoJson?.coordinates?.[0]) continue;
    lineMap.set(line.id, { id: line.id, polyline: geoJson.coordinates[0] });
  }
  console.log(`Loaded ${lineMap.size} lines with geometry`);

  const candidatePairs = await findCandidatePairs(dataSource);
  console.log(`Found ${candidatePairs.length} candidate line pairs`);

  const transfers: Partial<LineTransfer>[] = [];
  for (let i = 0; i < candidatePairs.length; i++) {
    const { lineA, lineB } = candidatePairs[i];
    const lineAData = lineMap.get(lineA);
    const lineBData = lineMap.get(lineB);

    if (lineAData && lineBData) {
      const pairTransfers = findAllTransferPoints(lineAData, lineBData);
      transfers.push(...pairTransfers);
    }

    if ((i + 1) % 100 === 0 || i === candidatePairs.length - 1) {
      process.stdout.write(
        `\rProcessing: ${i + 1}/${candidatePairs.length} pairs`,
      );
    }
  }
  process.stdout.write('\n');
  console.log(`Computed ${transfers.length} transfer points`);

  await saveBatched(transferRepository, transfers);
  console.log('Transfer computation complete');

  await dataSource.destroy();
}

interface CandidatePair {
  lineA: number;
  lineB: number;
}

async function findCandidatePairs(
  ds: DataSource,
): Promise<CandidatePair[]> {
  const query = `
    SELECT DISTINCT a.id AS line_a_id, b.id AS line_b_id
    FROM lines a
    JOIN lines b ON a.id <> b.id
    WHERE ST_DWithin(a.geom::geography, b.geom::geography, $1)
      AND a.id < b.id
  `;

  const rows: { line_a_id: number; line_b_id: number }[] =
    await ds.query(query, [TRANSFER_RADIUS_METERS]);

  return rows.map((r) => ({
    lineA: r.line_a_id,
    lineB: r.line_b_id,
  }));
}

function findAllTransferPoints(
  lineA: LineData,
  lineB: LineData,
): Partial<LineTransfer>[] {
  const forwardResults: Partial<LineTransfer>[] = [];

  for (let i = 0; i < lineA.polyline.length; i++) {
    const pA = lineA.polyline[i];
    let localMin = Infinity;
    let localBest: {
      j: number;
      dist: number;
      pB: number[];
    } | null = null;

    for (let j = 0; j < lineB.polyline.length; j++) {
      const pB = lineB.polyline[j];
      const dist = haversine(pA, pB);

      if (dist <= TRANSFER_RADIUS_METERS && dist < localMin) {
        localMin = dist;
        localBest = { j, dist, pB };
      }
    }

    if (localBest) {
      forwardResults.push({
        lineAId: lineA.id,
        lineBId: lineB.id,
        pointALng: pA[0],
        pointALat: pA[1],
        pointAIndex: i,
        pointBLng: localBest.pB[0],
        pointBLat: localBest.pB[1],
        pointBIndex: localBest.j,
        walkDistance: Math.round(localBest.dist),
      });
    }
  }

  const dedupedForward = deduplicateNearby(forwardResults);

  const inverseResults: Partial<LineTransfer>[] = dedupedForward.map(
    (t) => ({
      lineAId: t.lineBId,
      lineBId: t.lineAId,
      pointALng: t.pointBLng,
      pointALat: t.pointBLat,
      pointAIndex: t.pointBIndex,
      pointBLng: t.pointALng,
      pointBLat: t.pointALat,
      pointBIndex: t.pointAIndex,
      walkDistance: t.walkDistance,
    }),
  );

  const dedupedInverse = deduplicateNearby(inverseResults);

  return [...dedupedForward, ...dedupedInverse];
}

function deduplicateNearby(
  transfers: Partial<LineTransfer>[],
): Partial<LineTransfer>[] {
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
        const distA = haversine(
          [existing.pointALng!, existing.pointALat!],
          [candidate.pointALng!, candidate.pointALat!],
        );
        const distB = haversine(
          [existing.pointBLng!, existing.pointBLat!],
          [candidate.pointBLng!, candidate.pointBLat!],
        );
        return distA < MIN_SEPARATION_METERS && distB < MIN_SEPARATION_METERS;
      });
      if (!tooClose) dedupedGroup.push(candidate);
    }
    result.push(...dedupedGroup);
  }
  return result;
}

function haversine(coord1: number[], coord2: number[]): number {
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

async function saveBatched(
  repo: ReturnType<DataSource['getRepository']>,
  transfers: Partial<LineTransfer>[],
): Promise<void> {
  const total = transfers.length;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = transfers.slice(i, i + BATCH_SIZE);
    await repo.save(batch);
    process.stdout.write(`\rSaved ${Math.min(i + BATCH_SIZE, total)}/${total}`);
  }
  process.stdout.write('\n');
}

computeTransfers().catch((err) => {
  console.error('Transfer computation failed:', err);
  process.exit(1);
});
