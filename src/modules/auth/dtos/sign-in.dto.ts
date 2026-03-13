import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class SignInDto {
  @IsString()
  @MinLength(4)
  nickname!: string;
  @IsString()
  @IsStrongPassword()
  password!: string;
}
