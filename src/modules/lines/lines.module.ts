import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Line } from './line.entity';
import { LinesService } from './lines.service';
import { LinesController } from './lines.controller';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [TypeOrmModule.forFeature([Line]), ReviewsModule],
  controllers: [LinesController],
  providers: [LinesService],
  exports: [LinesService],
})
export class LinesModule {}
