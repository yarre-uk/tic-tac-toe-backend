import { Injectable } from '@nestjs/common';
import { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../../services/prisma.client';
import { UpdateUserDto } from './update-user.dto';

@Injectable()
export class UserRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findOne({ id }: { id: string }) {
    return this.prismaService.user.findUnique({ where: { id } });
  }

  findByEmail({ email }: { email: string }) {
    return this.prismaService.user.findUnique({ where: { email } });
  }

  findByNickname({ nickname }: { nickname: string }) {
    return this.prismaService.user.findUnique({ where: { nickname } });
  }

  findAll() {
    return this.prismaService.user.findMany();
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prismaService.user.create({ data });
  }

  update({ id }: { id: string }, data: UpdateUserDto): Promise<User> {
    return this.prismaService.user.update({ where: { id }, data });
  }

  delete({ id }: { id: string }): Promise<User> {
    return this.prismaService.user.delete({ where: { id } });
  }
}
