import { Controller, Get, Query } from '@nestjs/common';
import { IsPublic } from '@/guards';
import { AvailabilityService } from './availability.service';

@IsPublic()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get('nickname')
  checkNickname(@Query('nickname') nickname: string) {
    return { available: !this.availabilityService.hasNickname(nickname) };
  }

  @Get('email')
  checkEmail(@Query('email') email: string) {
    return { available: !this.availabilityService.hasEmail(email) };
  }
}
