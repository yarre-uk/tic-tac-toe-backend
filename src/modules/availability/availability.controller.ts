import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { AvailabilityService } from './availability.service';
import { AvailabilityResponseDto } from './dto/availability-response.dto';

import { IsPublic } from '@/guards';

@ApiTags('Availability')
@IsPublic()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @ApiOperation({ summary: 'Check if a nickname is available' })
  @ApiQuery({ name: 'nickname', description: 'Nickname to check' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @Get('nickname')
  checkNickname(@Query('nickname') nickname: string) {
    return { available: !this.availabilityService.hasNickname(nickname) };
  }

  @ApiOperation({ summary: 'Check if an email is available' })
  @ApiQuery({ name: 'email', description: 'Email address to check' })
  @ApiOkResponse({ type: AvailabilityResponseDto })
  @Get('email')
  checkEmail(@Query('email') email: string) {
    return { available: !this.availabilityService.hasEmail(email) };
  }
}
