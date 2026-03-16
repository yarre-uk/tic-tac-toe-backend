import { Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';
import { UserRepository } from '@/repositories';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, UserRepository],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
