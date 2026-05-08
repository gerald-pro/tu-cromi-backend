import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComputeTransfersCommand } from './compute-transfers.command';
import { SeedCommand } from './seed.command';
import { LinesSeeder } from '../database/seeders/lines.seeder';
import { ReviewsSeeder } from '../database/seeders/reviews.seeder';
import { Line } from '../modules/lines/line.entity';
import { LineTransfer } from '../modules/transfers/line-transfer.entity';
import { Review } from '../modules/reviews/review.entity';
import { User } from '../modules/users/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Line, LineTransfer, Review, User])],
  providers: [ComputeTransfersCommand, SeedCommand, LinesSeeder, ReviewsSeeder],
})
export class CommandsModule {}
