import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AvailabilityModule } from '@/availability/availability.module';

@Module({
  imports: [UsersModule, AvailabilityModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
