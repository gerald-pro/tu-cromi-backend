import { Injectable } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { LinesSeeder } from '../database/seeders/lines.seeder';
import { ReviewsSeeder } from '../database/seeders/reviews.seeder';

interface SeedOptions {
  force?: boolean;
  reviews?: boolean;
}

@Injectable()
@Command({
  name: 'seed',
  description: 'Seed the database with transit lines and reviews',
})
export class SeedCommand extends CommandRunner {
  constructor(
    private readonly linesSeeder: LinesSeeder,
    private readonly reviewsSeeder: ReviewsSeeder,
  ) {
    super();
  }

  async run(_passedParams: string[], options: SeedOptions): Promise<void> {
    console.log('=== Seeding database ===\n');

    if (options.force) {
      console.log('Force mode enabled - reseeding database\n');
    }

    await this.linesSeeder.run(options.force);

    if (options.reviews || options.force) {
      console.log('\n--- Seeding reviews ---\n');
      await this.reviewsSeeder.run(options.force);
    }

    console.log('\nSeeding complete');
  }

  @Option({
    flags: '-f, --force',
    description: 'Force reseeding even if data already exists',
  })
  parseForce(): boolean {
    return true;
  }

  @Option({
    flags: '-r, --reviews',
    description: 'Seed reviews for existing lines',
  })
  parseReviews(): boolean {
    return true;
  }
}
