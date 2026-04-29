import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiPropertyOptional({ example: 'john@example.com', nullable: true })
  email?: string | null;

  @ApiProperty({ example: 'john-doe' })
  nickname!: string;

  @ApiPropertyOptional({ example: 'P@ssw0rd123!' })
  password?: string | null;

  @ApiPropertyOptional({ example: 'googleId' })
  googleId?: string | null;
}
