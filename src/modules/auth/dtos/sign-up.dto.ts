import {
  IsEmail,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  @MinLength(4)
  nickname!: string;
  @IsString()
  @IsEmail()
  email?: string;
  @IsString()
  @IsStrongPassword()
  password!: string;
}
