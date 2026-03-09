import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '@/decorators/user.decorator';
import type { UserPayload } from '@/auth/auth.service';
import { UpdateUserDto } from './dto/update-user.dto';

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
