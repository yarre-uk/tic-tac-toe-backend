import { Module } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { RoomRepository } from '@/repositories';

@Module({
  controllers: [RoomsController],
  providers: [RoomsService, RoomRepository],
})
export class RoomsModule {}
