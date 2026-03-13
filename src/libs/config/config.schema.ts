import * as z from 'zod';

export const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  ACCESS_TOKEN_TTL: z.coerce.number().optional().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().optional().default(604800),
  BCRYPT_ROUNDS: z.coerce.number().optional().default(10),
  FALSE_POSITIVE_RATE: z.coerce.number().optional().default(0.01),
});

export type EnvSchemaInferred = z.infer<typeof EnvSchema>;
