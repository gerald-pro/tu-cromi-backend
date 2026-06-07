import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
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

  @ApiPropertyOptional({
    example: 10,
    description: 'Máximo de resultados (default: 10)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Máximo de trasbordos permitidos (0 = solo directos, 1 = hasta 1 trasbordo, 2 = hasta 2 trasbordos, default: 2)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  maxTransfers?: number;
}
