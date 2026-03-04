/* eslint-disable @typescript-eslint/require-await */
import { Injectable } from '@nestjs/common';
import { LoginDto as SignInDto } from './dtos/sign-in.dto';
import { LoginDto as SignUpDto } from './dtos/sign-up.dto';
import { Role } from '@/generated/prisma/enums';

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
  async signIn(_dto: SignInDto): Promise<TokensResponse> {
    return { accessToken: '', refreshToken: '' };
  }

  async signUp(_dto: SignUpDto): Promise<TokensResponse> {
    return { accessToken: '', refreshToken: '' };
  }

  logOut(): void {}
}
