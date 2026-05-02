import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RoomsService } from './rooms.service';
import { RoomResponseDto } from './dto';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @ApiOperation({ summary: 'List all rooms' })
  @ApiOkResponse({ type: [RoomResponseDto] })
  @Get()
  async findAll() {
    const rooms = await this.roomsService.findAll();
    return RoomResponseDto.fromList(rooms);
  }

  @ApiOperation({ summary: 'Get a room by id' })
  @ApiOkResponse({ type: RoomResponseDto })
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const room = await this.roomsService.findOne(id);
    return RoomResponseDto.from(room);
  }
}
