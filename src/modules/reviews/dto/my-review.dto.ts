import { ApiProperty } from '@nestjs/swagger';

export class LineSummaryDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'L1' })
  code: string;

  @ApiProperty({ example: 'Línea 1' })
  name: string;

  @ApiProperty({ example: '#FF0000' })
  color: string;
}

export class MyReviewDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiProperty({ example: 'Buen servicio', nullable: true })
  comment: string | null;

  @ApiProperty()
  line: LineSummaryDto;

  @ApiProperty()
  createdAt: Date;
}
