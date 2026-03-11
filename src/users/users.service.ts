import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { isDefined } from '@/utils';
import { PrismaService } from '@/libs';

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

  async findByEmail(email: string) {
    const user = await this.prismaService.user.findUnique({ where: { email } });

    if (!isDefined(user)) {
      throw new NotFoundException(`User ${email} not found`);
    }

    return user;
  }

  async findByNickname(nickname: string) {
    const user = await this.prismaService.user.findUnique({
      where: { nickname },
    });

    if (!isDefined(user)) {
      throw new NotFoundException(`User ${nickname} not found`);
    }

    return user;
  }

  async create(createUserDto: CreateUserDto) {
    try {
      return await this.prismaService.user.create({
        data: {
          ...createUserDto,
          role: 'User',
        },
      });
    } catch {
      throw new InternalServerErrorException(
        `Failed to create a user: ${createUserDto.nickname}`,
      );
    }
  }

  async update(id: string, data: UpdateUserDto) {
    await this.findOne(id);
    try {
      return await this.prismaService.user.update({ where: { id }, data });
    } catch {
      throw new InternalServerErrorException(`Failed to update user: ${id}`);
    }
  }

  async delete(id: string) {
    await this.findOne(id);
    try {
      return await this.prismaService.user.delete({ where: { id } });
    } catch {
      throw new InternalServerErrorException(`Failed to delete user: ${id}`);
    }
  }
}
