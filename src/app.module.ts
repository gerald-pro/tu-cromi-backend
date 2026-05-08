import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
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
import { CommandsModule } from './commands/commands.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      database: process.env.DATABASE_NAME || 'tucromi',
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      autoLoadEntities: true,
      synchronize: false,
    }),
    CommandsModule,
    AuthModule,
    UsersModule,
    LinesModule,
    FavoritesModule,
    SearchModule,
    TransfersModule,
    ReviewsModule,
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
