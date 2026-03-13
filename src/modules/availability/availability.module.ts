import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { UserRepository } from '@/repositories';

@Module({
  providers: [AvailabilityService, UserRepository],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
