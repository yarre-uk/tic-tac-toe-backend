import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/services/prisma.client';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { isDefined } from '@/utils';

@Injectable()
export class UsersService {
  constructor(private readonly prismaService: PrismaService) {}

  findAll() {
    return this.prismaService.user.findMany();
  }

  async findOne(id: string) {
    const user = await this.prismaService.user.findUnique({ where: { id } });

    if (!isDefined(user)) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  findByEmail(email: string) {
    return this.prismaService.user.findUnique({ where: { email } });
  }

  findByNickname(nickname: string) {
    return this.prismaService.user.findUnique({ where: { nickname } });
  }

  create(createUserDto: CreateUserDto) {
    return this.prismaService.user.create({
      data: {
        ...createUserDto,
        role: 'User',
      },
    });
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);
    return this.prismaService.user.update({ where: { id }, data });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prismaService.user.delete({ where: { id } });
  }
}
