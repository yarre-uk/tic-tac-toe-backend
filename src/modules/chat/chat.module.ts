import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

import { RoomsModule } from '@/modules/rooms';

@Module({
  imports: [RoomsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
