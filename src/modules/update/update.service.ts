import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { v4 } from 'uuid';
import { InstallUpdateDto } from './dto/install-update.dto';
import { TransferCacheService } from '../../cache/transfer-cache.service';

const BATCH_SIZE = 1000;

interface UpdateRecord {
  updateId: string;
  status: 'processing' | 'completed' | 'failed';
  version?: number;
  error?: string;
}

interface MetaRecord {
  version: number;
  generated_at: string;
  total_lines: number;
  total_transfers: number;
}

@Injectable()
export class UpdateService implements OnModuleInit {
  private readonly logger = new Logger(UpdateService.name);
  private readonly updates = new Map<string, UpdateRecord>();

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly transferCache: TransferCacheService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Fire-and-forget: don't block boot waiting for download
    this.autoInstallIfEmpty();
  }

  private async autoInstallIfEmpty(): Promise<void> {
    const dataUrl = process.env.DEFAULT_DATA_URL;
    if (!dataUrl) return;

    try {
      const rows = await this.dataSource.query(
        'SELECT COUNT(*) AS cnt FROM lines',
      );
      if (rows[0]?.cnt > 0) {
        this.logger.log('Data already present — skipping auto-install');
        return;
      }
    } catch {
      this.logger.log('Table not ready yet — will auto-install');
    }

    this.logger.log(`Auto-installing from DEFAULT_DATA_URL: ${dataUrl}`);

    try {
      const dto = new InstallUpdateDto();
      dto.dataDownloadUrl = dataUrl;
      // install() fires the download in background and returns immediately
      await this.install(dto);
    } catch (error) {
      this.logger.error(
        `Auto-install failed: ${(error as Error).message}`,
      );
    }
  }

  async install(dto: InstallUpdateDto) {
    try {
      const metaUrl =
        dto.metaUrl ?? dto.dataDownloadUrl.replace('data.ndjson.gz', 'meta.json');

      this.logger.log(`Fetching meta file: ${metaUrl}`);
      const metaResp = await fetch(metaUrl);
      if (!metaResp.ok) {
        throw new Error(`Failed to fetch meta file: ${metaResp.status}`);
      }
      const meta: MetaRecord = await metaResp.json();

      this.logger.log(
        `Remote meta — version: ${meta.version}, lines: ${meta.total_lines}, transfers: ${meta.total_transfers}, generated: ${meta.generated_at}`,
      );

      const rows = await this.dataSource.query(
        'SELECT * FROM version_metadata ORDER BY created_at DESC LIMIT 1',
      );
      const current = rows[0] ?? null;

      if (current) {
        this.logger.log(
          `Current DB version: ${current.version} (${current.generated_at ?? 'unknown'})`,
        );
      } else {
        this.logger.log('No version data in DB — first install');
      }

      if (current && current.version >= meta.version) {
        this.logger.log(
          `Skipping update: current ${current.version} >= remote ${meta.version}`,
        );
        return {
          status: 'skipped',
          version: meta.version,
          message: 'Ya actualizado',
        };
      }

      this.logger.log(
        `Remote version ${meta.version} is newer — starting update`,
      );

      const updateId = v4();
      this.updates.set(updateId, {
        updateId,
        status: 'processing',
        version: meta.version,
      });

      setImmediate(() => this.processUpdate(updateId, meta, dto.dataDownloadUrl));

      return { status: 'processing', updateId, version: meta.version };
    } catch (error) {
      this.logger.error(
        `install error: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  getStatus(updateId: string) {
    const record = this.updates.get(updateId);
    if (!record) {
      return { status: 'not_found', updateId };
    }
    return {
      status: record.status,
      updateId: record.updateId,
      version: record.version,
      error: record.error,
    };
  }

  private async processUpdate(
    updateId: string,
    meta: MetaRecord,
    dataDownloadUrl: string,
  ) {
    const startTime = Date.now();
    this.logger.log(
      `Processing update ${updateId} for version ${meta.version}`,
    );

    try {
      this.logger.log(`Downloading data file: ${dataDownloadUrl}`);
      const resp = await fetch(dataDownloadUrl);
      if (!resp.ok) {
        throw new Error(`Failed to fetch data file: ${resp.status}`);
      }

      const contentLength = resp.headers.get('content-length');
      this.logger.log(
        `Download started (content-length: ${contentLength ? (+contentLength / 1024 / 1024).toFixed(2) + ' MB' : 'unknown'})`,
      );

      const body = resp.body;
      if (!body) {
        throw new Error('Empty response body from R2');
      }

      const nodeStream = Readable.fromWeb(
        body as import('stream/web').ReadableStream,
      );
      const gunzip = createGunzip();
      const lineReader = createInterface({
        input: nodeStream.pipe(gunzip),
        crlfDelay: Infinity,
      });

      let lineBatch: object[] = [];
      let transferBatch: object[] = [];
      let lineCount = 0;
      let transferCount = 0;
      let headGeneratedAt = '';

      const logProgress = (label: string, count: number) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.logger.log(`[${elapsed}s] ${label}: ${count}`);
      };

      this.logger.log('Clearing existing data...');
      await this.dataSource.query('DELETE FROM line_transfers');
      await this.dataSource.query('DELETE FROM lines');
      logProgress('Cleared existing data', 0);

      this.logger.log('Streaming and processing NDJSON...');

      for await (const line of lineReader) {
        if (!line.trim()) continue;

        const record = JSON.parse(line);

        if (record.type === 'meta') {
          headGeneratedAt = record.generated_at ?? '';
          continue;
        }

        if (record.type === 'line') {
          lineBatch.push(record);
          lineCount++;

          if (lineBatch.length >= BATCH_SIZE) {
            await this.batchInsertLines(lineBatch);
            lineBatch = [];
            if (lineCount % (BATCH_SIZE * 10) === 0) {
              logProgress(`Lines inserted`, lineCount);
            }
          }
          continue;
        }

        if (record.type === 'transfer') {
          if (lineBatch.length > 0) {
            await this.batchInsertLines(lineBatch);
            lineBatch = [];
          }

          transferBatch.push(record);
          transferCount++;

          if (transferBatch.length >= BATCH_SIZE) {
            await this.batchInsertTransfers(transferBatch);
            transferBatch = [];
            if (transferCount % (BATCH_SIZE * 10) === 0) {
              logProgress(`Transfers inserted`, transferCount);
            }
          }
        }
      }

      if (lineBatch.length > 0) {
        await this.batchInsertLines(lineBatch);
      }
      if (transferBatch.length > 0) {
        await this.batchInsertTransfers(transferBatch);
      }

      logProgress('Lines inserted', lineCount);
      logProgress('Transfers inserted', transferCount);

      this.logger.log('Saving version metadata to DB...');
      await this.dataSource.query(
        `INSERT INTO version_metadata (version, generated_at, total_lines, total_transfers, data_download_url, size_bytes) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          meta.version,
          headGeneratedAt || meta.generated_at,
          lineCount,
          transferCount,
          dataDownloadUrl,
          contentLength ? +contentLength : 0,
        ],
      );
      logProgress('Version metadata saved', meta.version);

      this.logger.log('Reloading transfer cache...');
      await this.transferCache.reload();
      logProgress('Transfer cache reloaded', 0);

      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(
        `✅ Update ${updateId} completed — version ${meta.version}: ${lineCount} lines, ${transferCount} transfers in ${totalElapsed}s`,
      );
      this.updates.set(updateId, {
        updateId,
        status: 'completed',
        version: meta.version,
      });
    } catch (error) {
      const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.error(
        `❌ Update ${updateId} failed after ${totalElapsed}s: ${(error as Error).message}`,
      );
      this.updates.set(updateId, {
        updateId,
        status: 'failed',
        version: meta.version,
        error: (error as Error).message,
      });
    }
  }

  private async batchInsertLines(batch: any[]) {
    const values = batch
      .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .join(', ');
    const params = batch.flatMap((r) => [
      r.id,
      r.code,
      r.name ?? null,
      r.sense,
      r.color ?? null,
      r.geo_json !== undefined ? JSON.stringify(r.geo_json) : null,
      r.parent_line_id ?? null,
      r.syndicate ?? null,
      r.objectid ?? null,
      r.average_rating ?? null,
      r.total_reviews ?? 0,
    ]);
    await this.dataSource.query(
      `INSERT INTO lines (id, code, name, sense, color, geo_json, parent_line_id, syndicate, objectid, average_rating, total_reviews) VALUES ${values}`,
      params,
    );
  }

  private async batchInsertTransfers(batch: any[]) {
    const values = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = batch.flatMap((r) => [
      r.line_a_id,
      r.line_b_id,
      r.point_a_lng,
      r.point_a_lat,
      r.point_a_index,
      r.point_b_lng,
      r.point_b_lat,
      r.point_b_index,
      r.walk_distance,
    ]);
    await this.dataSource.query(
      `INSERT INTO line_transfers (line_a_id, line_b_id, point_a_lng, point_a_lat, point_a_index, point_b_lng, point_b_lat, point_b_index, walk_distance) VALUES ${values}`,
      params,
    );
  }
}
