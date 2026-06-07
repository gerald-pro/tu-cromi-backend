import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { LinesService } from './lines.service';
import { ReviewsService } from '../reviews/reviews.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('lines')
@Controller('lines')
export class LinesController {
  constructor(
    private readonly linesService: LinesService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Obtener todas las líneas' })
  @ApiResponse({ status: 200, description: 'Lista de líneas' })
  async findAll() {
    return this.linesService.findAll();
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
    return line;
  }

  @Get(':id/opposite')
  @Public()
  @ApiOperation({ summary: 'Obtener la línea de sentido contrario' })
  @ApiResponse({ status: 200, description: 'Línea opuesta' })
  @ApiResponse({ status: 404, description: 'No tiene línea opuesta' })
  async findOpposite(@Param('id') id: string) {
    const opposite = await this.linesService.findOpposite(id);
    if (!opposite) {
      throw new NotFoundException('Esta línea no tiene sentido contrario');
    }
    return opposite;
  }

  @Get(':id/reviews')
  @Public()
  @ApiOperation({ summary: 'Obtener reseñas de una línea' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Página (default 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Límite por página (default 10)',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['newest', 'highest', 'lowest'],
    description: 'Ordenar por',
  })
  @ApiResponse({ status: 200, description: 'Lista de reseñas' })
  async findReviews(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('sort') sort: string = 'newest',
  ) {
    const lineId = parseInt(id, 10);
    const line = await this.linesService.findById(lineId);
    if (!line) {
      throw new NotFoundException('Línea no encontrada');
    }
    const result = await this.reviewsService.findByLine(
      lineId,
      page,
      limit,
      sort,
    );
    return {
      data: result.data,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: Math.ceil(result.total / result.limit),
      },
    };
  }
}
