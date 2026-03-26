export const AppEvents = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
} as const;

export type AppEvent = (typeof AppEvents)[keyof typeof AppEvents];
