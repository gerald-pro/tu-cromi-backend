import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Starting CLI...\n');
  try {
    await CommandFactory.run(AppModule, {
      logger: ['error', 'warn'],
    });
  } catch (err) {
    console.error('\n❌ CLI Error:', err);
    process.exit(1);
  }
}

bootstrap();
