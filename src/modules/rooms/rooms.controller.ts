import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { User } from '@/decorators';
import type { UserPayload } from '@/modules/auth';
import { RoomsService } from './rooms.service';
import { CreateRoomDto, RoomResponseDto, UpdateRoomDto } from './dto';

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

  @ApiOperation({ summary: 'Create a room — fails if already in one' })
  @ApiOkResponse({ type: RoomResponseDto })
  @Post()
  async create(@User() user: UserPayload, @Body() dto: CreateRoomDto) {
    const room = await this.roomsService.create(user.sub, dto);
    return RoomResponseDto.from(room);
  }

  @ApiOperation({
    summary: 'Join a room — if already in another room, leaves it first',
  })
  @ApiOkResponse({ type: RoomResponseDto })
  @Post(':id/join')
  async join(@User() user: UserPayload, @Param('id') id: string) {
    const room = await this.roomsService.join(user.sub, id);
    return RoomResponseDto.from(room);
  }

  @ApiOperation({ summary: 'Leave current room' })
  @ApiNoContentResponse()
  @Delete('leave')
  leave(@User() user: UserPayload) {
    return this.roomsService.leave(user.sub);
  }

  @ApiOperation({ summary: 'Update room name — owner only' })
  @ApiOkResponse({ type: RoomResponseDto })
  @Patch(':id')
  async update(
    @User() user: UserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    const room = await this.roomsService.update(user.sub, id, dto);
    return RoomResponseDto.from(room);
  }
}
