import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VersionMetadata } from './version-metadata.entity';
import { VersionResponseDto } from './dto/version-response.dto';

@Injectable()
export class OfflineService {
  private readonly logger = new Logger(OfflineService.name);

  constructor(
    @InjectRepository(VersionMetadata)
    private readonly versionRepo: Repository<VersionMetadata>,
  ) {}

  async getCurrentVersion(): Promise<VersionResponseDto> {
    const rows = await this.versionRepo.find({
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const current = rows[0] ?? null;

    if (!current) {
      throw new NotFoundException('No hay datos disponibles');
    }

    if (!current.sizeBytes && current.dataDownloadUrl) {
      try {
        const headResp = await fetch(current.dataDownloadUrl, {
          method: 'HEAD',
        });
        const contentLength = headResp.headers.get('content-length');
        if (contentLength) {
          await this.versionRepo.update(current.id, {
            sizeBytes: +contentLength,
          });
          current.sizeBytes = +contentLength;
        }
      } catch {
        this.logger.warn(
          `Could not resolve sizeBytes via HEAD for ${current.dataDownloadUrl}`,
        );
      }
    }

    return {
      version: current.version,
      generatedAt: current.generatedAt,
      totalLines: current.totalLines,
      totalTransfers: current.totalTransfers,
      dataDownloadUrl: current.dataDownloadUrl,
      sizeBytes: current.sizeBytes,
      updatedAt: current.updatedAt,
    };
  }
}
