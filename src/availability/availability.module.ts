import { Module } from '@nestjs/common';
import { AvailabilityService } from '../availability/availability.service';
import { UserRepository } from '@/repositories/user/user.repository';

@Module({
  providers: [AvailabilityService, UserRepository],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
