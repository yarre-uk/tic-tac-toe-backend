#!/bin/sh
set -euo pipefail

POSTGRES_USER=$(aws ssm get-parameter \
  --name "/ttt/prod/POSTGRES_USER" --region eu-west-1 \
  --query "Parameter.Value" --output text)

POSTGRES_PASSWORD=$(aws ssm get-parameter \
  --name "/ttt/prod/POSTGRES_PASSWORD" --with-decryption --region eu-west-1 \
  --query "Parameter.Value" --output text)

POSTGRES_DB=$(aws ssm get-parameter \
  --name "/ttt/prod/POSTGRES_DB" --region eu-west-1 \
  --query "Parameter.Value" --output text)

REDIS_PASSWORD=$(aws ssm get-parameter \
  --name "/ttt/prod/REDIS_PASSWORD" --with-decryption --region eu-west-1 \
  --query "Parameter.Value" --output text)

export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

npx prisma migrate deploy

exec node dist/src/main.js
