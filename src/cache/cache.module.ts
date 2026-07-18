import { Module } from '@nestjs/common';
import { TransferCacheService } from './transfer-cache.service';

@Module({
  providers: [TransferCacheService],
  exports: [TransferCacheService],
})
export class CacheModule {}
