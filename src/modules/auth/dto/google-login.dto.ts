import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ example: 'eyJhbGciOiJSUzI1NiIs...' })
  @IsString()
  token: string;
}
