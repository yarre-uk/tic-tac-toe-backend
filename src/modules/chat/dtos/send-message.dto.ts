import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'gg wp', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;
}
