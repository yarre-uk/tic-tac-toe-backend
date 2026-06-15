import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { ChatService } from './chat.service';
import { ChatMessageDto } from './dtos';

import { User } from '@/decorators';
import type { UserPayload } from '@/modules/auth/auth.service';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @ApiOkResponse({ type: [ChatMessageDto] })
  @Get(':roomId/messages')
  async getMessages(
    @Param('roomId') roomId: string,
    @User() user: UserPayload,
  ): Promise<ChatMessageDto[]> {
    return this.chatService.getMessages(user.sub, roomId);
  }
}
