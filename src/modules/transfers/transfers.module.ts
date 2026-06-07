import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineTransfer } from './line-transfer.entity';
import { TransferCacheService } from './transfer-cache.service';
import { TransfersAdminController } from './transfers-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LineTransfer])],
  providers: [TransferCacheService],
  controllers: [TransfersAdminController],
  exports: [TypeOrmModule, TransferCacheService],
})
export class TransfersModule {}
