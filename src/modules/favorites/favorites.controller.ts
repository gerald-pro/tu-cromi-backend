import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('favorites')
@Controller('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener mis favoritos' })
  @ApiResponse({ status: 200, description: 'Lista de favoritos' })
  async findAll(@CurrentUser('id') userId: string) {
    return {
      data: await this.favoritesService.findByUser(userId),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Agregar línea a favoritos' })
  @ApiResponse({ status: 201, description: 'Favorito creado' })
  @ApiResponse({ status: 409, description: 'Ya está en favoritos' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFavoriteDto,
  ) {
    return {
      data: await this.favoritesService.create(userId, dto.lineId, dto.name),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar de favoritos' })
  @ApiResponse({ status: 204, description: 'Favorito eliminado' })
  @ApiResponse({ status: 404, description: 'Favorito no encontrado' })
  async delete(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.favoritesService.delete(userId, id);
  }
}
