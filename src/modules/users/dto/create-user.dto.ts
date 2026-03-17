import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiPropertyOptional({ example: 'john@example.com', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'johndoe' })
  nickname!: string;

  @ApiProperty({ example: 'P@ssw0rd123!' })
  password!: string;
}
