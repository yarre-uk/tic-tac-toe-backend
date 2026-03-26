import { Role } from '@/generated/prisma/enums';
import { AppEvents } from './app.events';

export interface EventPayloads {
  [AppEvents.USER_CREATED]: {
    userId: string;
    nickname: string;
    email: string | null;
    role: Role;
  };
  [AppEvents.USER_UPDATED]: {
    userId: string;
    nickname: string;
    email: string | null;
    role: Role;
  };
}
