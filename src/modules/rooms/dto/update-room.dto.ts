import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateRoomDto {
  @ApiPropertyOptional({ example: 'new-name', maxLength: 32, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  name?: string | null;
}
