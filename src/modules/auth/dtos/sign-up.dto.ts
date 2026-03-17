import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class SignUpDto {
  @ApiProperty({ example: 'johndoe', minLength: 4 })
  @IsString()
  @MinLength(4)
  nickname!: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: 'P@ssw0rd123!' })
  @IsString()
  @IsStrongPassword()
  password!: string;
}
