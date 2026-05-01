import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRoomDto {
  @ApiPropertyOptional({ example: 'my-room', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string;
}
