import { Module } from '@nestjs/common';

import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

import { UserRepository } from '@/repositories';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService, UserRepository],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
