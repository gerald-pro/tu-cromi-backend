import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineTransfer } from './line-transfer.entity';
import { TransferCacheService } from './transfer-cache.service';

@Module({
  imports: [TypeOrmModule.forFeature([LineTransfer])],
  providers: [TransferCacheService],
  exports: [TypeOrmModule, TransferCacheService],
})
export class TransfersModule {}
