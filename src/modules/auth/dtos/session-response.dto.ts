import { ApiProperty } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty({ example: '01912a3b-7c8d-7e9f-a0b1-c2d3e4f50678' })
  id!: string;

  @ApiProperty()
  expiresAt!: Date;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty({ example: true })
  isActive!: boolean;
}
