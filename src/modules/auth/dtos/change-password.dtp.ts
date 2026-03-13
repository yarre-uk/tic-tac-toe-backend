import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(4)
  nickname!: string;
  @IsString()
  @IsStrongPassword()
  oldPassword!: string;
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
