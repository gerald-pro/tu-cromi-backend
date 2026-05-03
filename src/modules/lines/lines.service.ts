import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Line } from './line.entity';

@Injectable()
export class LinesService {
  constructor(
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async findAll(): Promise<Line[]> {
    const lines = await this.lineRepository.find({
      select: {
        id: true,
        code: true,
        name: true,
        color: true,
        sense: true,
        parentLineId: true,
        syndicate: true,
        objectid: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return lines.sort((a, b) => {
      const numA = parseInt(a.code.match(/^\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.code.match(/^\d+/)?.[0] || '0', 10);
      return numA - numB;
    });
  }

  async findById(id: string): Promise<Line | null> {
    return this.lineRepository.findOne({
      where: { id },
      relations: ['parentLine'],
    });
  }

  async findByCode(code: string): Promise<Line | null> {
    return this.lineRepository.findOne({
      where: { code },
      relations: ['parentLine'],
    });
  }

  async findOpposite(code: string): Promise<Line | null> {
    const line = await this.findByCode(code);
    if (!line?.parentLineId) return null;
    return this.findById(line.parentLineId);
  }
}
