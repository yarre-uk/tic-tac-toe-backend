export const SocketEvent = {
  Rooms: {
    CREATE: 'room:create',
    JOIN: 'room:join',
    REJOIN: 'room:rejoin',
    LEAVE: 'room:leave',
    UPDATE: 'room:update',

    CREATED: 'room:created',
    JOINED: 'room:joined',
    REJOINED: 'room:rejoined',
    LEFT: 'room:left',
    UPDATED: 'room:updated',
  },

  Auth: {
    AUTH_REFRESH: 'auth:refresh',

    AUTH_REFRESHED: 'auth:refreshed',
  },
} as const;
