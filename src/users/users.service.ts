import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@/generated/prisma/enums';
import { isDefined } from '@/utils';
import { UserRepository } from '@/repositories/user/user.repository';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  findAll() {
    return this.userRepository.findAll();
  }

  async findOne(id: string) {
    const user = await this.userRepository.findById(id);

    if (!isDefined(user)) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.userRepository.findByEmail(email);

    if (!isDefined(user)) {
      throw new NotFoundException(`User ${email} not found`);
    }

    return user;
  }

  async findByNickname(nickname: string) {
    const user = await this.userRepository.findByNickname(nickname);

    if (!isDefined(user)) {
      throw new NotFoundException(`User ${nickname} not found`);
    }

    return user;
  }

  create(createUserDto: CreateUserDto) {
    return this.userRepository.create({ ...createUserDto, role: Role.User });
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);
    return this.userRepository.update(id, data);
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.userRepository.delete(id);
  }
}
