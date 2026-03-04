import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateUserDto, UserRepository } from '@/repositories';
import { Prisma } from '@/generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findAll() {
    return this.userRepository.findAll();
  }

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ id });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  create(data: Prisma.UserCreateInput) {
    return this.userRepository.create(data);
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);
    return this.userRepository.update({ id }, data);
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.userRepository.delete({ id });
  }
}
