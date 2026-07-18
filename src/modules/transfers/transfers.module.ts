import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineTransfer } from './line-transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LineTransfer])],
})
export class TransfersModule {}
