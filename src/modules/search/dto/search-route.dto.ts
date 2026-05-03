import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchRouteDto {
  @ApiProperty({
    example: '-17.783327, -63.182115',
    description: 'Punto de origen (lat, lng)',
  })
  @IsString()
  @IsNotEmpty()
  origin: string;

  @ApiProperty({
    example: '-17.444444, -63.066111',
    description: 'Punto de destino (lat, lng)',
  })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Incluir polilíneas en la respuesta (default: true)',
  })
  @IsOptional()
  @IsBoolean()
  includePolylines?: boolean;
}
