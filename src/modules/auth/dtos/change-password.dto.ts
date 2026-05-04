import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'johndoe', minLength: 4 })
  @IsString()
  @MinLength(4)
  nickname!: string;

  @ApiProperty({ example: 'OldP@ssw0rd123!' })
  @IsString()
  @IsStrongPassword()
  oldPassword!: string;

  @ApiProperty({ example: 'NewP@ssw0rd123!' })
  @IsString()
  @IsStrongPassword()
  newPassword!: string;
}
