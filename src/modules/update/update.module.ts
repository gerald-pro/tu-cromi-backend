import { Module } from '@nestjs/common';
import { CacheModule } from '../../cache/cache.module';
import { UpdateController } from './update.controller';
import { UpdateService } from './update.service';

@Module({
  imports: [CacheModule],
  controllers: [UpdateController],
  providers: [UpdateService],
})
export class UpdateModule {}
