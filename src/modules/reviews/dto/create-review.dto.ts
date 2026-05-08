import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReviewDto {
  @ApiProperty({ description: 'ID de la línea', example: 1 })
  @IsInt()
  lineId: number;

  @ApiProperty({ description: 'Calificación de 1 a 5', example: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    description: 'Comentario (opcional)',
    example: 'Buen servicio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
