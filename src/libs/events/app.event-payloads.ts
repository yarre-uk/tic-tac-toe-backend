import type { AppEvents } from './app.events';

import type { Role } from '@/generated/prisma/enums';

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
