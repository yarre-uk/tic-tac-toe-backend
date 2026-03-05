import { Injectable, UnauthorizedException } from '@nestjs/common';
import { LoginDto as SignInDto } from './dtos/sign-in.dto';
import { LoginDto as SignUpDto } from './dtos/sign-up.dto';
import { Role } from '@/generated/prisma/enums';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '@/users/users.service';
import { isDefined } from '@/utils';

interface TokensResponse {
  accessToken: string;
  refreshToken: string;
}

export interface JwtUserPayload {
  id: string;
  role: Role;
  iat: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async signIn(dto: SignInDto): Promise<TokensResponse> {
    const user = await this.usersService.findByNickname(dto.nickname);

    if (!isDefined(user) || user.password !== dto.password) {
      throw new UnauthorizedException('Credentials are incorrect!');
    }

    const payload = {
      iat: Date.now(),
      id: user.id,
      role: user.role,
    } satisfies JwtUserPayload;

    const accessToken = this.jwtService.sign(payload);

    return { accessToken: accessToken, refreshToken: '' };
  }

  async signUp(dto: SignUpDto): Promise<TokensResponse> {
    const createdUser = await this.usersService.create(dto);

    const payload = {
      iat: Date.now(),
      id: createdUser.id,
      role: createdUser.role,
    } satisfies JwtUserPayload;

    const accessToken = this.jwtService.sign(payload);

    return { accessToken: accessToken, refreshToken: '' };
  }

  logOut(): void {}
}
