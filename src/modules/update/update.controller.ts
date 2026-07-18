import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { UpdateService } from './update.service';
import { AdminKeyGuard } from './admin-key.guard';
import { InstallUpdateDto } from './dto/install-update.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('update')
@Public()
@Controller('admin/update')
@UseGuards(AdminKeyGuard)
export class UpdateController {
  constructor(private readonly updateService: UpdateService) {}

  @Post('install')
  @ApiOperation({
    summary: 'Verificar versión en R2 y actualizar si es necesario',
  })
  @ApiResponse({ status: 200, description: 'Ya actualizado (skipped)' })
  @ApiResponse({
    status: 202,
    description: 'Actualización iniciada en background',
  })
  @ApiResponse({ status: 401, description: 'Admin-Key inválida' })
  async install(
    @Body() dto: InstallUpdateDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.updateService.install(dto);
    if (result.status === 'processing') {
      res.status(202);
    }
    return result;
  }

  @Get('status/:updateId')
  @ApiOperation({ summary: 'Estado de una actualización en curso' })
  @ApiResponse({ status: 200, description: 'Estado de la actualización' })
  async getStatus(@Param('updateId') updateId: string) {
    return this.updateService.getStatus(updateId);
  }
}
