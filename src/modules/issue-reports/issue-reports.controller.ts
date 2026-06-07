import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { IssueReportsService } from './issue-reports.service';
import { CreateIssueReportDto } from './dto/create-issue-report.dto';
import { UpdateIssueReportDto } from './dto/update-issue-report.dto';
import { IssueReportDto } from './dto/issue-report.dto';
import { IssueReportStatus } from './issue-report-status.enum';
import { IssueReportType } from './issue-report-type.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@ApiTags('issue-reports')
@Controller('issue-reports')
export class IssueReportsController {
  constructor(private readonly issueReportsService: IssueReportsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Crear reporte de problema' })
  @ApiResponse({
    status: 201,
    description: 'Reporte creado',
    type: IssueReportDto,
  })
  @ApiResponse({ status: 404, description: 'Línea no encontrada' })
  async create(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateIssueReportDto,
  ): Promise<IssueReportDto> {
    const report = await this.issueReportsService.create(userId, dto);
    return this.toDto(report);
  }

  @Get('my')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener mis reportes' })
  @ApiResponse({
    status: 200,
    description: 'Lista de reportes',
    type: [IssueReportDto],
  })
  async findMyReports(
    @CurrentUser('id') userId: number,
  ): Promise<IssueReportDto[]> {
    const reports = await this.issueReportsService.findByUser(userId);
    return reports.map((r) => this.toDto(r));
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Listar reportes (admin)' })
  @ApiQuery({ name: 'status', required: false, enum: IssueReportStatus })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'lineId', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista de reportes',
    type: [IssueReportDto],
  })
  async findAll(
    @Query('status') status?: IssueReportStatus,
    @Query('type') type?: string,
    @Query('lineId') lineId?: string,
  ): Promise<IssueReportDto[]> {
    const reports = await this.issueReportsService.findAll({
      status,
      type,
      lineId: lineId ? parseInt(lineId, 10) : undefined,
    });
    return reports.map((r) => this.toDto(r));
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Obtener reporte por ID' })
  @ApiResponse({
    status: 200,
    description: 'Reporte encontrado',
    type: IssueReportDto,
  })
  @ApiResponse({ status: 404, description: 'Reporte no encontrado' })
  async findById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<IssueReportDto> {
    const report = await this.issueReportsService.findById(id);
    return this.toDto(report);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Actualizar estado del reporte (admin)' })
  @ApiResponse({
    status: 200,
    description: 'Estado actualizado',
    type: IssueReportDto,
  })
  @ApiResponse({ status: 404, description: 'Reporte no encontrado' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIssueReportDto,
  ): Promise<IssueReportDto> {
    const report = await this.issueReportsService.updateStatus(id, dto);
    return this.toDto(report);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Eliminar reporte (admin o dueño)' })
  @ApiResponse({ status: 200, description: 'Reporte eliminado' })
  @ApiResponse({ status: 404, description: 'Reporte no encontrado' })
  @ApiResponse({ status: 403, description: 'Permiso denegado' })
  async delete(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.issueReportsService.delete(id, userId);
    return { message: 'Reporte eliminado' };
  }

  private toDto(report: any): IssueReportDto {
    return {
      id: report.id,
      userId: report.userId,
      lineId: report.lineId,
      type: report.type,
      description: report.description,
      location: report.location,
      status: report.status,
      adminNotes: report.adminNotes,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }
}
