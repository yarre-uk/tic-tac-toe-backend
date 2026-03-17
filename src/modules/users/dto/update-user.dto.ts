import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'john@example.com', nullable: true })
  email?: string | null;

  @ApiPropertyOptional({ example: 'newjohndoe' })
  nickname?: string;

  @ApiPropertyOptional({ example: 'NewP@ssw0rd123!' })
  password?: string;
}
