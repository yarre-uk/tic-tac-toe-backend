import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtAuthGuard } from './guards/auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { LoggingInterceptor } from './interceptors/logging.interceptor';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { GlobalExceptionFilter } from './exceptions/exception.filter';
import {
  ApiConfigModule,
  ApiConfigService,
  EventsModule,
  PrismaModule,
  RedisModule,
} from './libs';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
  ],
  providers: [
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
})
export class AppModule {}
