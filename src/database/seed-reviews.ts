import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Review } from '../modules/reviews/review.entity';
import { User } from '../modules/users/user.entity';
import { Line } from '../modules/lines/line.entity';
import { Favorite } from '../modules/favorites/favorite.entity';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  database: process.env.DATABASE_NAME || 'tucromi',
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  entities: [Review, User, Line, Favorite],
  ssl:
    process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const COMMENTS = [
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

async function seedReviews(): Promise<void> {
  await dataSource.initialize();
  console.log('Database connected');

  const reviewRepository = dataSource.getRepository(Review);
  const userRepository = dataSource.getRepository(User);
  const lineRepository = dataSource.getRepository(Line);

  const existingReviews = await reviewRepository.count();
  const force = process.argv.includes('--force');

  if (existingReviews > 0) {
    if (force) {
      console.log(`Deleting ${existingReviews} existing reviews (--force)...`);
      await reviewRepository.delete({});
    } else {
      console.log(
        `Reviews already seeded (${existingReviews} found). Skipping.`,
      );
      await dataSource.destroy();
      return;
    }
  }

  const users = await userRepository.find();
  const lines = await lineRepository.find();

  if (users.length === 0) {
    console.log('No users found. Cannot seed reviews without users.');
    await dataSource.destroy();
    return;
  }

  if (lines.length === 0) {
    console.log('No lines found. Cannot seed reviews without lines.');
    await dataSource.destroy();
    return;
  }

  console.log(
    `Seeding reviews: ${users.length} users, ${lines.length} lines...`,
  );

  const reviews: Partial<Review>[] = [];

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
          ? COMMENTS[Math.floor(Math.random() * COMMENTS.length)]
          : undefined,
      });
    }
  }

  const savedReviews = await reviewRepository.save(reviews);
  console.log(`Created ${savedReviews.length} reviews`);

  for (const line of lines) {
    const result = await reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.lineId = :lineId', { lineId: line.id })
      .getRawOne();

    const avg = parseFloat(result?.avg ?? '0');
    const count = parseInt(result?.count ?? '0', 10);

    await lineRepository.update(line.id, {
      averageRating: count > 0 ? avg : null,
      totalReviews: count,
    });
  }

  console.log('Line ratings updated');
  await dataSource.destroy();
  console.log('Reviews seeding complete');
}

seedReviews().catch((err) => {
  console.error('Reviews seeding failed:', err);
  process.exit(1);
});
