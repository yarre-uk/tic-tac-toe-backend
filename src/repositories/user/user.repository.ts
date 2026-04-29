import { Injectable } from '@nestjs/common';
import { User } from '@/generated/prisma/client';
import { Role } from '@/generated/prisma/enums';
import { PrismaService } from '@/libs';
import { CreateUserDto, UpdateUserDto } from '@/modules';

export type UserIdentifiers = Pick<User, 'nickname' | 'email'>;

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findAll(): Promise<User[]>;
  findAllIdentifiers(): Promise<UserIdentifiers[]>;
  findByEmail(email: string): Promise<User | null>;
  findByNickname(nickname: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  create(data: CreateUserDto & { role: Role }): Promise<User>;
  update(id: string, data: UpdateUserDto): Promise<User>;
  delete(id: string): Promise<User>;
}

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  findAllIdentifiers() {
    return this.prisma.user.findMany({
      select: { nickname: true, email: true },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByNickname(nickname: string) {
    return this.prisma.user.findUnique({ where: { nickname } });
  }

  findByGoogleId(googleId: string) {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  create(data: CreateUserDto & { role: Role }) {
    return this.prisma.user.create({ data });
  }

  update(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({ where: { id }, data });
  }

  delete(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }
}
