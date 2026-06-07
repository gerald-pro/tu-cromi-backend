import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { MyReviewDto } from './dto/my-review.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear o actualizar reseña de una línea' })
  @ApiResponse({ status: 201, description: 'Reseña creada/actualizada' })
  @ApiResponse({ status: 404, description: 'Línea no encontrada' })
  async createOrUpdate(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateReviewDto,
  ) {
    return await this.reviewsService.createOrUpdate(userId, dto);
  }

  @Get('my-reviews')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener mis reseñas' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reseñas',
    type: [MyReviewDto],
  })
  async findMyReviews(
    @CurrentUser('id') userId: number,
  ): Promise<MyReviewDto[]> {
    return await this.reviewsService.findByUser(userId);
  }

  @Post(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Actualizar mi reseña' })
  @ApiResponse({ status: 200, description: 'Reseña actualizada' })
  @ApiResponse({ status: 404, description: 'Reseña no encontrada' })
  @ApiResponse({ status: 403, description: 'Permiso denegado' })
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReviewDto,
  ) {
    return await this.reviewsService.update(userId, id, dto);
  }

  @Post(':id/delete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Eliminar mi reseña' })
  @ApiResponse({ status: 200, description: 'Reseña eliminada' })
  @ApiResponse({ status: 404, description: 'Reseña no encontrada' })
  @ApiResponse({ status: 403, description: 'Permiso denegado' })
  async delete(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.reviewsService.delete(userId, id);
    return { message: 'Reseña eliminada' };
  }
}
