export const SocketEvent = {
  Rooms: {
    CREATE: 'room:create',
    JOIN: 'room:join',
    LEAVE: 'room:leave',
    UPDATE: 'room:update',

    CREATED: 'room:created',
    JOINED: 'room:joined',
    LEFT: 'room:left',
    UPDATED: 'room:updated',
  },

  Auth: {
    AUTH_REFRESH: 'auth:refresh',

    AUTH_REFRESHED: 'auth:refreshed',
  },
} as const;
