import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto';
import type { UserPayload } from '../auth';
import { User } from '@/decorators';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  getProfile(@User() user: UserPayload) {
    return this.usersService.findOne(user.sub);
  }

  @Patch('profile')
  updateProfile(@User() user: UserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.sub, dto);
  }
}
