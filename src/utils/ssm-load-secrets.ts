import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm';

export async function loadSecretsFromSSM(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[SSM] Skipping SSM env loading in dev environment');
    return;
  }

  try {
    const ssm = new SSMClient({
      region: process.env.AWS_REGION ?? 'eu-west-1',
    });

    let nextToken: string | undefined;

    do {
      const response = await ssm.send(
        new GetParametersByPathCommand({
          Path: '/ttt/prod/',
          WithDecryption: true,
          Recursive: true,
          NextToken: nextToken,
        }),
      );

      for (const param of response.Parameters ?? []) {
        const key = param.Name!.split('/').pop()!;
        process.env[key] = param.Value!;
      }

      nextToken = response.NextToken;
    } while (nextToken);

    console.log('[SSM] Secrets loaded');
  } catch (err) {
    console.error('[SSM] Failed to load secrets — exiting', err);
    process.exit(1);
  }
}
