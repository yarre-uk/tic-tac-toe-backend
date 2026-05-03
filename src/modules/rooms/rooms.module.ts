import { Module } from '@nestjs/common';

import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';

import { RoomRepository } from '@/repositories';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomRepository, RoomsGateway],
})
export class RoomsModule {}
