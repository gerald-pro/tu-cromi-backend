import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchRouteDto } from './dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post()
  @Public()
  @ApiOperation({ summary: 'Buscar ruta entre dos puntos' })
  @ApiResponse({
    status: 200,
    description: 'Rutas encontradas ordenadas por distancia',
  })
  async search(@Body() dto: SearchRouteDto) {
    return this.searchService.search(dto);
  }
}
