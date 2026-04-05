import { IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CoordinatesDto {
  @ApiProperty({ example: -17.783327 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: -63.182115 })
  @IsNumber()
  lng: number;
}
