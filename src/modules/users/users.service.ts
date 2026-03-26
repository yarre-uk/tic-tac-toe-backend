import { Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@/generated/prisma/enums';
import { isDefined } from '@/utils';
import { UserRepository } from '@/repositories';
import { AppEvents, TypedEventEmitter } from '@/libs';
import { CreateUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventEmitter: TypedEventEmitter,
  ) {}

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

  async create(createUserDto: CreateUserDto) {
    const user = await this.userRepository.create({
      ...createUserDto,
      role: Role.User,
    });

    this.eventEmitter.emit(AppEvents.USER_CREATED, {
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
    });

    return user;
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);
    const user = await this.userRepository.update(id, data);

    this.eventEmitter.emit(AppEvents.USER_UPDATED, {
      userId: user.id,
      nickname: user.nickname,
      email: user.email,
      role: user.role,
    });

    return user;
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.userRepository.delete(id);
  }
}
