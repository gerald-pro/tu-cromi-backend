import {
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TransferCacheService } from './transfer-cache.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

interface ComputeState {
  running: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  transfersCreated: number | null;
  duration: string | null;
  error: string | null;
}

@ApiTags('admin')
@Controller('admin/transfers')
export class TransfersAdminController {
  private state: ComputeState = {
    running: false,
    startedAt: null,
    completedAt: null,
    transfersCreated: null,
    duration: null,
    error: null,
  };

  constructor(private readonly transferCache: TransferCacheService) {}

  @Post('reload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Recargar caché de trasbordos desde la base de datos' })
  @ApiResponse({ status: 200, description: 'Caché recargada correctamente' })
  @ApiResponse({ status: 403, description: 'Acceso de administrador requerido' })
  async reload() {
    await this.transferCache.reload();
    return { message: 'Caché de trasbordos recargada correctamente' };
  }

  @Post('compute')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Calcular trasbordos (asíncrono)' })
  @ApiResponse({ status: 200, description: 'Cálculo iniciado' })
  @ApiResponse({ status: 409, description: 'Ya hay un cálculo en ejecución' })
  @ApiResponse({ status: 403, description: 'Acceso de administrador requerido' })
  async compute() {
    if (this.state.running) {
      return {
        message: 'Ya hay un cálculo en ejecución',
        startedAt: this.state.startedAt,
      };
    }

    this.state = {
      running: true,
      startedAt: new Date(),
      completedAt: null,
      transfersCreated: null,
      duration: null,
      error: null,
    };

    const scriptPath = path.resolve(
      __dirname,
      '../../database/compute-transfers.js',
    );
    const child = spawn('node', [scriptPath], {
      cwd: path.resolve(__dirname, '../../..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes('DeprecationWarning')) return;
      this.state.error = (this.state.error ?? '') + msg;
    });

    child.on('error', (err) => {
      this.state.running = false;
      this.state.completedAt = new Date();
      this.state.error = err.message;
    });

    child.on('exit', async (code) => {
      this.state.running = false;
      this.state.completedAt = new Date();

      if (code === 0) {
        const match = stdout.match(
          /__TRANSFER_RESULT__(\{.+\})__TRANSFER_RESULT__/,
        );
        if (match) {
          try {
            const result = JSON.parse(match[1]);
            this.state.transfersCreated = result.transfersCreated;
            this.state.duration = result.duration;
          } catch {
            this.state.error = 'Error al parsear resultado del cálculo';
          }
        }

        try {
          await this.transferCache.reload();
        } catch (err: unknown) {
          this.state.error = `Transferencias calculadas pero error al recargar caché: ${(err as Error).message}`;
        }
      } else {
        this.state.error =
          this.state.error || `El proceso terminó con código ${code}`;
      }
    });

    return {
      message: 'Cálculo de trasbordos iniciado',
      startedAt: this.state.startedAt,
    };
  }

  @Get('compute/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Estado del cálculo de trasbordos' })
  @ApiResponse({ status: 200, description: 'Estado actual' })
  @ApiResponse({ status: 403, description: 'Acceso de administrador requerido' })
  async status() {
    return {
      running: this.state.running,
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
      transfersCreated: this.state.transfersCreated,
      duration: this.state.duration,
      error: this.state.error,
    };
  }
}
