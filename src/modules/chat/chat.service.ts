import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { v7 as uuidv7 } from 'uuid';

import { ChatMessageDto } from './dtos';

import { AppEvents } from '@/libs';
import { REDIS_CLIENT_KEY } from '@/libs/redis/redis.module';
import { RoomsService } from '@/modules/rooms';

// How long a room's chat history lives in Redis without any new messages.
// If the room is deleted we DEL the key immediately; this TTL is a safety net
// for any keys that were never cleaned up (e.g. server crash during leave).
const CHAT_TTL_SECONDS = 60 * 60 * 1; // 1 hour

const MAX_MESSAGES = 100;

@Injectable()
export class ChatService {
  constructor(
    @Inject(REDIS_CLIENT_KEY) private readonly redis: Redis,
    private readonly roomsService: RoomsService,
  ) {}

  private key(roomId: string): string {
    // Namespaced key so chat data never collides with other Redis keys
    // (e.g. blacklist:*, auth:*, etc.)
    return `chat:${roomId}`;
  }

  async addMessage(
    userId: string,
    roomId: string,
    payload: Omit<ChatMessageDto, 'id' | 'sentAt' | 'userId'>,
  ): Promise<ChatMessageDto> {
    await this.roomsService.inRoom(userId, roomId);

    const message = new ChatMessageDto({
      id: uuidv7(),
      sentAt: new Date().toISOString(),
      userId,
      ...payload,
    });

    const key = this.key(roomId);

    // O(1) — Redis lists are doubly-linked with head/tail pointers, so RPUSH
    // (append) is constant time regardless of list length.
    await this.redis.rpush(key, JSON.stringify(message));

    // Negative indices count from the tail: -MAX_MESSAGES is "100 from the end".
    // This keeps the oldest messages and drops any overflow beyond the cap.
    // LTRIM is O(N) only for the removed elements — typically just one per write.
    await this.redis.ltrim(key, -MAX_MESSAGES, -1);

    // Reset TTL on every new message so an active chat never expires mid-session.
    await this.redis.expire(key, CHAT_TTL_SECONDS);

    return message;
  }

  async getMessages(userId: string, roomId: string): Promise<ChatMessageDto[]> {
    await this.roomsService.inRoom(userId, roomId);

    // LRANGE 0 -1 returns the full list. Because we RPUSH, it is already
    // oldest-first — no reversal needed.
    const raw = await this.redis.lrange(this.key(roomId), 0, -1);

    return raw.map(
      (entry) => new ChatMessageDto(JSON.parse(entry) as ChatMessageDto),
    );
  }

  async deleteMessages(roomId: string): Promise<void> {
    await this.redis.del(this.key(roomId));
  }

  @OnEvent(AppEvents.ROOM_DELETED)
  async onRoomDeleted(payload: { roomId: string }): Promise<void> {
    await this.deleteMessages(payload.roomId);
  }
}
