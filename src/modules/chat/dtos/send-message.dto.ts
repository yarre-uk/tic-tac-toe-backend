import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty()
  @IsUUID()
  roomId!: string;

  @ApiProperty({ example: 'gg wp', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content!: string;
}
