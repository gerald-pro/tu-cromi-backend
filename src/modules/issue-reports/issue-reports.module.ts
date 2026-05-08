import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IssueReport } from './issue-report.entity';
import { IssueReportsService } from './issue-reports.service';
import { IssueReportsController } from './issue-reports.controller';
import { Line } from '../lines/line.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IssueReport, Line])],
  controllers: [IssueReportsController],
  providers: [IssueReportsService],
  exports: [IssueReportsService],
})
export class IssueReportsModule {}
