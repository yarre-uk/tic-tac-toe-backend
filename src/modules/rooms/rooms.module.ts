import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { RoomRepository } from '@/repositories';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomRepository, RoomsGateway],
})
export class RoomsModule {}
