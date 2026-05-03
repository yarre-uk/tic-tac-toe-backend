import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { UserPayload } from '../auth';

import { UpdateUserDto, UserLike, UserResponseDto } from './dto';
import { UsersService } from './users.service';

import { User } from '@/decorators';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  @Get('profile')
  async getProfile(@User() user: UserPayload) {
    const found: UserLike = await this.usersService.findOne(user.sub);
    return UserResponseDto.from(found);
  }

  @ApiOperation({ summary: 'Update current user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  @Patch('profile')
  async updateProfile(@User() user: UserPayload, @Body() dto: UpdateUserDto) {
    const updated: UserLike = await this.usersService.update(user.sub, dto);
    return UserResponseDto.from(updated);
  }
}
