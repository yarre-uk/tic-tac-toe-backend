import * as z from 'zod';

export const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),

  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.coerce.number().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().default(604800),

  BCRYPT_ROUNDS: z.coerce.number().default(10),
  FALSE_POSITIVE_RATE: z.coerce.number().default(0.01),

  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().min(1),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
});

export type EnvSchemaInferred = z.infer<typeof EnvSchema>;
