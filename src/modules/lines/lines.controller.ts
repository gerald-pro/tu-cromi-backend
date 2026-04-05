import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LinesService } from './lines.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('lines')
@Controller('lines')
export class LinesController {
  constructor(private readonly linesService: LinesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Obtener todas las líneas' })
  @ApiResponse({ status: 200, description: 'Lista de líneas' })
  async findAll() {
    return {
      data: await this.linesService.findAll(),
    };
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener detalle de una línea por ID o código' })
  @ApiResponse({ status: 200, description: 'Detalle de línea' })
  @ApiResponse({ status: 404, description: 'Línea no encontrada' })
  async findOne(@Param('id') id: string) {
    const line = await this.linesService.findByCode(id);
    if (!line) {
      throw new NotFoundException('Línea no encontrada');
    }
    return { data: line };
  }

  @Get(':id/opposite')
  @Public()
  @ApiOperation({ summary: 'Obtener la línea de sentido contrario' })
  @ApiResponse({ status: 200, description: 'Línea opuesta' })
  @ApiResponse({ status: 404, description: 'No tiene línea opuesta' })
  async findOpposite(@Param('id') id: string) {
    const line = await this.linesService.findByCode(id);
    if (!line) {
      throw new NotFoundException('Línea no encontrada');
    }
    if (!line.parentLineId) {
      throw new NotFoundException('Esta línea no tiene sentido contrario');
    }
    const opposite = await this.linesService.findById(line.parentLineId);
    if (!opposite) {
      throw new NotFoundException('Esta línea no tiene sentido相反');
    }
    return { data: opposite };
  }
}
