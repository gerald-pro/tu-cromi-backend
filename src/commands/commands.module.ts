import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComputeTransfersCommand } from './compute-transfers.command';
import { SeedCommand } from './seed.command';
import { LinesSeeder } from '../database/seeders/lines.seeder';
import { Line } from '../modules/lines/line.entity';
import { LineTransfer } from '../modules/transfers/line-transfer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Line, LineTransfer])],
  providers: [ComputeTransfersCommand, SeedCommand, LinesSeeder],
})
export class CommandsModule {}
