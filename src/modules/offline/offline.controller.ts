import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OfflineService } from './offline.service';
import { VersionResponseDto } from './dto/version-response.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('offline')
@Public()
@Controller('offline')
export class OfflineController {
  constructor(private readonly offlineService: OfflineService) {}

  @Get('version')
  @ApiOperation({
    summary: 'Obtener la versión actual de los datos offline',
  })
  @ApiResponse({
    status: 200,
    description: 'Versión actual',
    type: VersionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No hay datos disponibles' })
  async getVersion(): Promise<VersionResponseDto> {
    return this.offlineService.getCurrentVersion();
  }
}
