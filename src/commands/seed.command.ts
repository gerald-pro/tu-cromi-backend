import { Injectable } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { LinesSeeder } from '../database/seeders/lines.seeder';

interface SeedOptions {
  force?: boolean;
}

@Injectable()
@Command({
  name: 'seed',
  description: 'Seed the database with transit lines from GeoJSON data',
})
export class SeedCommand extends CommandRunner {
  constructor(private readonly linesSeeder: LinesSeeder) {
    super();
  }

  async run(_passedParams: string[], options: SeedOptions): Promise<void> {
    console.log('=== Seeding database ===\n');

    if (options.force) {
      console.log('Force mode enabled - reseeding database\n');
    }

    await this.linesSeeder.run(options.force);

    console.log('\nSeeding complete');
  }

  @Option({
    flags: '-f, --force',
    description: 'Force reseeding even if data already exists',
  })
  parseForce(): boolean {
    return true;
  }
}
