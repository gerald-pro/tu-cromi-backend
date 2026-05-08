import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueReport } from './issue-report.entity';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { UpdateIssueReportDto } from './dto/update-issue-report.dto';
import { IssueReportStatus } from './issue-report-status.enum';
import { Line } from '../lines/line.entity';

@Injectable()
export class IssueReportsService {
  constructor(
    @InjectRepository(IssueReport)
    private readonly issueReportRepository: Repository<IssueReport>,
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async create(userId: number | null, dto: CreateIssueReportDto): Promise<IssueReport> {
    if (dto.lineId) {
      const line = await this.lineRepository.findOne({ where: { id: dto.lineId } });
      if (!line) {
        throw new NotFoundException('Línea no encontrada');
      }
    }

    const report = this.issueReportRepository.create({
      userId: userId ?? undefined,
      lineId: dto.lineId,
      type: dto.type,
      description: dto.description,
      location: dto.location,
      status: IssueReportStatus.PENDING,
    });

    return await this.issueReportRepository.save(report);
  }

  async findAll(filters?: {
    status?: IssueReportStatus;
    type?: string;
    lineId?: number;
  }): Promise<IssueReport[]> {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.type) {
      where.type = filters.type;
    }
    if (filters?.lineId) {
      where.lineId = filters.lineId;
    }

    return await this.issueReportRepository.find({
      where,
      relations: ['user', 'line'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<IssueReport> {
    const report = await this.issueReportRepository.findOne({
      where: { id },
      relations: ['user', 'line'],
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    return report;
  }

  async findByUser(userId: number): Promise<IssueReport[]> {
    return await this.issueReportRepository.find({
      where: { userId },
      relations: ['line'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    reportId: number,
    dto: UpdateIssueReportDto,
  ): Promise<IssueReport> {
    const report = await this.issueReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    if (dto.status !== undefined) {
      report.status = dto.status;
    }
    if (dto.adminNotes !== undefined) {
      report.adminNotes = dto.adminNotes;
    }

    return await this.issueReportRepository.save(report);
  }

  async delete(reportId: number, userId: number): Promise<void> {
    const report = await this.issueReportRepository.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    if (report.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este reporte');
    }

    await this.issueReportRepository.softDelete(reportId);
  }
}
