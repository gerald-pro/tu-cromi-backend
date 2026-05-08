import { ApiProperty } from '@nestjs/swagger';
import { IssueReportType } from '../issue-report-type.enum';
import { IssueReportStatus } from '../issue-report-status.enum';

export class IssueReportDto {
  @ApiProperty()
  id: number;

  @ApiProperty({ nullable: true })
  userId: number;

  @ApiProperty({ nullable: true })
  lineId: number;

  @ApiProperty({ enum: IssueReportType })
  type: IssueReportType;

  @ApiProperty()
  description: string;

  @ApiProperty({ nullable: true })
  location: object;

  @ApiProperty({ enum: IssueReportStatus })
  status: IssueReportStatus;

  @ApiProperty({ nullable: true })
  adminNotes: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
