import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueReportStatus } from '../issue-report-status.enum';

export class UpdateIssueReportDto {
  @ApiPropertyOptional({ description: 'Nuevo estado', enum: IssueReportStatus })
  @IsOptional()
  status?: IssueReportStatus;

  @ApiPropertyOptional({ description: 'Notas del administrador', example: 'Verificado en terreno' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNotes?: string;
}
