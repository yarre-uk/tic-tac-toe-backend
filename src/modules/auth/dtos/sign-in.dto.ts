import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({ example: 'johndoe', minLength: 4 })
  @IsString()
  @MinLength(4)
  nickname!: string;

  @ApiProperty({ example: 'P@ssw0rd123!' })
  @IsString()
  @IsStrongPassword()
  password!: string;
}
