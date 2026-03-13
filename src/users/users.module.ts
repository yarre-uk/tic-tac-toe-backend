import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserRepository } from '@/repositories/user/user.repository';
import { AvailabilityModule } from '@/availability/availability.module';

@Module({
  imports: [AvailabilityModule],
  providers: [UsersService, UserRepository],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
