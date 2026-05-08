import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../modules/reviews/review.entity';
import { User } from '../../modules/users/user.entity';
import { Line } from '../../modules/lines/line.entity';

@Injectable()
export class ReviewsSeeder {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Line)
    private readonly lineRepository: Repository<Line>,
  ) {}

  async run(force = false): Promise<void> {
    const existingReviews = await this.reviewRepository.count();

    if (existingReviews > 0 && !force) {
      console.log('Reviews already seeded, skipping. Use --force to reseed.');
      return;
    }

    if (force && existingReviews > 0) {
      console.log(`Deleting ${existingReviews} existing reviews...`);
      await this.reviewRepository.delete({});
    }

    const users = await this.userRepository.find();
    const lines = await this.lineRepository.find();

    if (users.length === 0) {
      console.log('No users found. Please seed users first.');
      return;
    }

    if (lines.length === 0) {
      console.log('No lines found. Please seed lines first.');
      return;
    }

    console.log('Seeding reviews...');
    const reviews: Partial<Review>[] = [];
    const comments = [
      'Buen servicio, recomendado',
      'Puntual y cómodo',
      'El bus llegó rápido',
      'Muy buena ruta',
      'Servicio regular',
      'Excelente atención',
      'Podría mejorar la frecuencia',
      'Muy conforme con el servicio',
      'El chofer fue muy amable',
      'Buena alternativa de transporte',
    ];

    for (const user of users) {
      const numReviews = Math.floor(Math.random() * 5) + 1;
      const shuffledLines = [...lines].sort(() => Math.random() - 0.5);

      for (let i = 0; i < Math.min(numReviews, shuffledLines.length); i++) {
        const line = shuffledLines[i];
        const rating = Math.floor(Math.random() * 5) + 1;
        const hasComment = Math.random() > 0.3;

        reviews.push({
          userId: user.id,
          lineId: line.id,
          rating,
          comment: hasComment
            ? comments[Math.floor(Math.random() * comments.length)]
            : undefined,
        });
      }
    }

    await this.reviewRepository.save(reviews);
    console.log(`Created ${reviews.length} reviews`);

    await this.updateLineRatings(lines);
  }

  private async updateLineRatings(lines: Line[]): Promise<void> {
    console.log('Updating line ratings...');
    for (const line of lines) {
      const result = await this.reviewRepository
        .createQueryBuilder('review')
        .select('AVG(review.rating)', 'avg')
        .addSelect('COUNT(review.id)', 'count')
        .where('review.lineId = :lineId', { lineId: line.id })
        .getRawOne();

      const avg = parseFloat(result?.avg ?? '0');
      const count = parseInt(result?.count ?? '0', 10);

      await this.lineRepository.update(line.id, {
        averageRating: count > 0 ? avg : null,
        totalReviews: count,
      });
    }
    console.log('Line ratings updated');
  }
}
