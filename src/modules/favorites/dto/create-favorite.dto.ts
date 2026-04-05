import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFavoriteDto {
  @ApiProperty({ description: 'ID de la línea' })
  @IsUUID()
  lineId: string;

  @ApiPropertyOptional({ description: 'Nombre personalizado (opcional)' })
  @IsOptional()
  @IsString()
  name?: string;
}
