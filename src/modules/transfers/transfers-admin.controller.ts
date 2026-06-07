import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransferCacheService } from './transfer-cache.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('admin')
@Controller('admin/transfers')
export class TransfersAdminController {
  constructor(private readonly transferCache: TransferCacheService) {}

  @Post('reload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Recargar caché de trasbordos desde la base de datos' })
  @ApiResponse({ status: 200, description: 'Caché recargada correctamente' })
  @ApiResponse({ status: 403, description: 'Acceso de administrador requerido' })
  async reload() {
    await this.transferCache.reload();
    return { message: 'Caché de trasbordos recargada correctamente' };
  }
}
