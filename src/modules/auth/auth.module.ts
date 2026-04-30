import { Module } from '@nestjs/common';
import { UsersModule } from '../users';
import { AvailabilityModule } from '../availability';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionsController } from './sessions.controller';
import { GoogleStrategy } from '@/guards/strategies';

@Module({
  imports: [UsersModule, AvailabilityModule],
  providers: [AuthService, GoogleStrategy],
  controllers: [AuthController, SessionsController],
})
export class AuthModule {}
