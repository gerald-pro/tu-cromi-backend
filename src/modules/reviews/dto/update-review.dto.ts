import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReviewDto {
  @ApiPropertyOptional({ description: 'Calificación de 1 a 5', example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({
    description: 'Comentario (opcional)',
    example: 'Buen servicio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
