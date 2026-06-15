import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  sentAt: string;

  constructor(data: ChatMessageDto) {
    this.id = data.id;
    this.userId = data.userId;
    this.content = data.content;
    this.sentAt = data.sentAt;
  }
}
