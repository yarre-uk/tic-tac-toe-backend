import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { GlobalExceptionFilter } from './exceptions/exception.filter';
import { JwtAuthGuard, RolesGuard } from './guards';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import {
  ApiConfigModule,
  ApiConfigService,
  EventsModule,
  PrismaModule,
  RedisModule,
} from './libs';
import { AuthModule, UsersModule, RoomsModule } from './modules';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    ApiConfigModule.register({ global: true, envFilePath: '.env' }),
    PrismaModule.registerAsync({
      global: true,
      inject: [ApiConfigService],
      useFactory(configService: ApiConfigService) {
        return {
          dbUrl: configService.get('DATABASE_URL'),
        };
      },
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ApiConfigService],
      useFactory(configService: ApiConfigService) {
        return {
          secret: configService.get('JWT_SECRET'),
        };
      },
    }),
    RedisModule.registerAsync({
      global: true,
      inject: [ApiConfigService],
      useFactory(configService: ApiConfigService) {
        return {
          host: configService.get('REDIS_HOST'),
          password: configService.get('REDIS_PASSWORD'),
          port: configService.get('REDIS_PORT'),
        };
      },
    }),
    EventsModule,
    UsersModule,
    AuthModule,
    RoomsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  controllers: [AppController],
})
export class AppModule {}
