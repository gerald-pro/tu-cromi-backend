import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import configuration from './config/configuration';
import { HttpExceptionFilter, ResponseInterceptor } from './common';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { UsersModule } from './modules/users/users.module';
import { LinesModule } from './modules/lines/lines.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { AuthModule } from './modules/auth/auth.module';
import { SearchModule } from './modules/search/search.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { IssueReportsModule } from './modules/issue-reports/issue-reports.module';
import { UpdateModule } from './modules/update/update.module';
import { OfflineModule } from './modules/offline/offline.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const dbFile =
          process.env.DATABASE_FILE ||
          join(process.cwd(), 'data', 'tucromi.sqlite');
        const dbDir = join(dbFile, '..');
        if (!existsSync(dbDir)) {
          mkdirSync(dbDir, { recursive: true });
        }
        return {
          type: 'better-sqlite3',
          database: dbFile,
          autoLoadEntities: true,
          synchronize: process.env.DB_SYNCHRONIZE === 'true' || process.env.NODE_ENV !== 'production',
        };
      },
    }),
    AuthModule,
    UsersModule,
    LinesModule,
    FavoritesModule,
    SearchModule,
    TransfersModule,
    ReviewsModule,
    IssueReportsModule,
    UpdateModule,
    OfflineModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
