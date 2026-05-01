import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@/generated/prisma/enums';

export interface UserLike {
  id: string;
  email: string | null;
  nickname: string;
  role: Role;
  roomId: string | null;
}

export class UserResponseDto {
  @ApiProperty({ example: '01912a3b-7c8d-7e9f-a0b1-c2d3e4f50678' })
  id: string;

  @ApiPropertyOptional({ example: 'john@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: 'johndoe' })
  nickname: string;

  @ApiProperty({ enum: Role, enumName: 'Role', example: Role.User })
  role: Role;

  @ApiProperty({ example: '01912a3b-7c8d-7e9f-a0b1-c2d3e4f50678' })
  roomId: string | null;

  private constructor(user: UserLike) {
    this.id = user.id;
    this.email = user.email;
    this.nickname = user.nickname;
    this.role = user.role;
    this.roomId = user.roomId;
  }

  static from(user: UserLike): UserResponseDto {
    return new UserResponseDto(user);
  }

  static fromList(users: UserLike[]): UserResponseDto[] {
    return users.map((value) => UserResponseDto.from(value));
  }
}
