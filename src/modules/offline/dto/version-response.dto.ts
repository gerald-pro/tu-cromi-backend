import { ApiProperty } from '@nestjs/swagger';

export class VersionResponseDto {
  @ApiProperty({
    example: 42,
    description: 'Versión actual de los datos offline',
  })
  version: number;

  @ApiProperty({
    example: '2026-07-11T10:30:00.000Z',
    description: 'Fecha de generación de los datos',
    nullable: true,
  })
  generatedAt: string | null;

  @ApiProperty({ example: 156, description: 'Cantidad total de líneas' })
  totalLines: number;

  @ApiProperty({ example: 4820, description: 'Cantidad total de transferencias' })
  totalTransfers: number;

  @ApiProperty({
    example:
      'https://pub-a7b88ddf63c54f69b99ef91cd490b738.r2.dev/offline/data.ndjson.gz',
    description: 'URL pública de descarga del archivo NDJSON comprimido',
    nullable: true,
  })
  dataDownloadUrl: string | null;

  @ApiProperty({ example: 32505856, description: 'Tamaño del archivo en bytes' })
  sizeBytes: number;

  @ApiProperty({
    example: '2026-07-11T10:35:12.000Z',
    description: 'Fecha de instalación de esta versión en el servidor',
  })
  updatedAt: Date;
}
