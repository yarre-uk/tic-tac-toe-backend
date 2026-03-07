import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignInDto as SignInDto } from './dtos/sign-in.dto';
import { SignUpDto as SignUpDto } from './dtos/sign-up.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-in')
  async signIn(@Body() dto: SignInDto) {
    const { accessToken, refreshToken } = await this.authService.signIn(dto);

    console.log(refreshToken);

    return { accessToken };
  }

  @Post('sign-up')
  async signUp(@Body() dto: SignUpDto) {
    const { accessToken, refreshToken } = await this.authService.signUp(dto);

    console.log(refreshToken);

    return { accessToken };
  }

  @Post('logout')
  logOut() {
    //TODO get actual token from cookies
    const refreshToken = '';

    return this.authService.logOut(refreshToken);
  }
}
