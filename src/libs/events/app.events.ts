export const AppEvents = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  ROOM_DELETED: 'room.deleted',
} as const;

export type AppEvent = (typeof AppEvents)[keyof typeof AppEvents];
