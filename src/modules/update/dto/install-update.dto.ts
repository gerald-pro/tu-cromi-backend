import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InstallUpdateDto {
  @ApiProperty({
    example:
      'https://pub-a7b88ddf63c54f69b99ef91cd490b738.r2.dev/offline/data.ndjson.gz',
    description: 'Public download URL of the NDJSON gzip file',
  })
  @IsString()
  dataDownloadUrl: string;

  @ApiProperty({
    example:
      'https://pub-a7b88ddf63c54f69b99ef91cd490b738.r2.dev/offline/meta.json',
    description:
      'Public URL of the meta.json (optional, derived from dataDownloadUrl if omitted)',
    required: false,
  })
  @IsString()
  @IsOptional()
  metaUrl?: string;
}
