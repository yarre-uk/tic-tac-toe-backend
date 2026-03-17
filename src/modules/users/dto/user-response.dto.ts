import { Role } from '@/generated/prisma/enums';

export interface UserLike {
  id: string;
  email: string | null;
  nickname: string;
  role: Role;
}

export class UserResponseDto {
  id: string;
  email: string | null;
  nickname: string;
  role: Role;

  private constructor(user: UserLike) {
    this.id = user.id;
    this.email = user.email;
    this.nickname = user.nickname;
    this.role = user.role;
  }

  static from(user: UserLike): UserResponseDto {
    return new UserResponseDto(user);
  }

  static fromList(users: UserLike[]): UserResponseDto[] {
    return users.map((value) => UserResponseDto.from(value));
  }
}
