import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { Line } from '../lines/line.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { MyReviewDto } from './dto/my-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async createOrUpdate(userId: number, dto: CreateReviewDto): Promise<Review> {
    const line = await this.lineRepository.findOne({
      where: { id: dto.lineId },
    });
    if (!line) {
      throw new NotFoundException('Línea no encontrada');
    }

    let review = await this.reviewRepository.findOne({
      where: { userId, lineId: dto.lineId },
    });

    if (review) {
      review.rating = dto.rating;
      if (dto.comment !== undefined) {
        review.comment = dto.comment;
      }
    } else {
      review = this.reviewRepository.create({
        userId,
        lineId: dto.lineId,
        rating: dto.rating,
        comment: dto.comment,
      });
    }

    const savedReview = await this.reviewRepository.save(review);
    await this.updateLineRating(dto.lineId);
    return savedReview;
  }

  async findByLine(
    lineId: number,
    page: number = 1,
    limit: number = 10,
    sort: string = 'newest',
  ): Promise<{ data: Review[]; total: number; page: number; limit: number }> {
    const where = { lineId };
    let order: Record<string, 'ASC' | 'DESC'> = {};

    switch (sort) {
      case 'highest':
        order = { rating: 'DESC', createdAt: 'DESC' };
        break;
      case 'lowest':
        order = { rating: 'ASC', createdAt: 'DESC' };
        break;
      case 'newest':
      default:
        order = { createdAt: 'DESC' };
        break;
    }

    const [data, total] = await this.reviewRepository.findAndCount({
      where,
      relations: ['user'],
      order,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findByUser(userId: number): Promise<MyReviewDto[]> {
    const reviews = await this.reviewRepository.find({
      where: { userId },
      relations: ['line'],
      order: { createdAt: 'DESC' },
    });

    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      line: {
        id: review.line.id,
        code: review.line.code,
        name: review.line.name,
        color: review.line.color,
      },
      createdAt: review.createdAt,
    }));
  }

  async update(
    userId: number,
    reviewId: number,
    dto: UpdateReviewDto,
  ): Promise<Review> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('No tienes permiso para editar esta reseña');
    }

    if (dto.rating !== undefined) {
      review.rating = dto.rating;
    }
    if (dto.comment !== undefined) {
      review.comment = dto.comment;
    }

    const savedReview = await this.reviewRepository.save(review);
    await this.updateLineRating(review.lineId);
    return savedReview;
  }

  async delete(userId: number, reviewId: number): Promise<void> {
    const review = await this.reviewRepository.findOne({
      where: { id: reviewId },
      withDeleted: false,
    });

    if (!review) {
      throw new NotFoundException('Reseña no encontrada');
    }

    if (review.userId !== userId) {
      throw new ForbiddenException(
        'No tienes permiso para eliminar esta reseña',
      );
    }

    const lineId = review.lineId;
    await this.reviewRepository.softDelete(reviewId);
    await this.updateLineRating(lineId);
  }

  private async updateLineRating(lineId: number): Promise<void> {
    const raw: Record<string, string | null> | undefined =
      await this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'avg')
        .addSelect('COUNT(review.id)', 'count')
        .where('review.lineId = :lineId', { lineId })
        .andWhere('review.deleted_at IS NULL')
        .getRawOne();

    const result = raw as { avg: string; count: string } | null;
    const count = parseInt(result?.count ?? '0', 10);
    const avg = parseFloat(result?.avg ?? '0');

    const averageRating = count > 0 ? avg : null;
    const totalReviews = count;

    await this.lineRepository.update(lineId, {
      averageRating,
      totalReviews,
    });
  }
}
