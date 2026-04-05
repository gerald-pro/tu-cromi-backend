import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './favorite.entity';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private readonly favoriteRepository: Repository<Favorite>,
  ) {}

  async findByUser(userId: string): Promise<Favorite[]> {
    return this.favoriteRepository.find({
      where: { userId },
      relations: ['line'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    userId: string,
    lineId: string,
    name?: string,
  ): Promise<Favorite> {
    const existing = await this.favoriteRepository.findOne({
      where: { userId, lineId },
    });

    if (existing) {
      if (name) {
        existing.name = name;
        return this.favoriteRepository.save(existing);
      }
      return existing;
    }

    const favorite = this.favoriteRepository.create({
      userId,
      lineId,
      name,
    });

    return this.favoriteRepository.save(favorite);
  }

  async delete(userId: string, favoriteId: string): Promise<void> {
    const favorite = await this.favoriteRepository.findOne({
      where: { id: favoriteId },
    });

    if (!favorite) {
      throw new NotFoundException('Favorito no encontrado');
    }

    if (favorite.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar este favorito',
      );
    }

    await this.favoriteRepository.delete(favoriteId);
  }
}
