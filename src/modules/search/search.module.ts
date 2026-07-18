import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Line } from '../lines/line.entity';
import { LineTransfer } from '../transfers/line-transfer.entity';
import { CacheModule } from '../../cache/cache.module';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Line, LineTransfer]), CacheModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
