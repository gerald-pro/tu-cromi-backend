import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueReportType } from '../issue-report-type.enum';

export class CreateIssueReportDto {
  @ApiPropertyOptional({ description: 'ID de la línea (opcional)', example: 1 })
  @IsOptional()
  @IsInt()
  lineId?: number;

  @ApiProperty({ description: 'Tipo de reporte', enum: IssueReportType })
  type: IssueReportType;

  @ApiProperty({ description: 'Descripción del problema', example: 'La ruta ha cambiado en el centro' })
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({ description: 'Coordenadas del problema', example: { lat: -17.8, lng: -63.2 } })
  @IsOptional()
  location?: object;
}
