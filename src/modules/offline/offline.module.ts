import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VersionMetadata } from './version-metadata.entity';
import { OfflineService } from './offline.service';
import { OfflineController } from './offline.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VersionMetadata])],
  controllers: [OfflineController],
  providers: [OfflineService],
  exports: [OfflineService],
})
export class OfflineModule {}
