import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client';
import { Role } from '@/generated/prisma/enums';
import { isDefined } from '@/utils';
import { UserRepository } from '@/repositories';
import { AppEvents, TypedEventEmitter } from '@/libs';
import { CreateUserDto, UpdateUserDto } from './dto';
import { GoogleUserProfile } from './types';

const MAX_CREATING_GOOGLE_USER_ATTEMPTS = 10;

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

  async findOrCreateGoogleUser({
    googleId,
    email,
    nickname,
  }: GoogleUserProfile) {
    const byGoogleId = await this.userRepository.findByGoogleId(googleId);

    if (isDefined(byGoogleId)) {
      return byGoogleId;
    }

    const byEmail = await this.userRepository.findByEmail(email);

    if (isDefined(byEmail)) {
      return this.userRepository.update(byEmail.id, { googleId });
    }

    let attempt = 0;

    while (attempt < MAX_CREATING_GOOGLE_USER_ATTEMPTS) {
      const candidate = attempt === 0 ? nickname : `${nickname}${attempt}`;

      try {
        const user = await this.userRepository.create({
          googleId,
          email,
          nickname: candidate,
          password: null,
          role: Role.User,
        });

        this.eventEmitter.emit(AppEvents.USER_CREATED, {
          userId: user.id,
          nickname: user.nickname,
          email: user.email,
          role: user.role,
        });

        return user;
      } catch (error) {
        const isNicknameConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          (error.meta?.target as string[])?.includes('nickname');

        if (!isNicknameConflict) {
          throw error;
        }

        attempt++;
      }
    }

    throw new InternalServerErrorException(
      'Failed to generate a unique nickname for Google user',
    );
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
