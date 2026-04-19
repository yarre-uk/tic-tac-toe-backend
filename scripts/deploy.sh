#!/bin/bash
set -e

IMAGE_URI=$1

if [ -z "$IMAGE_URI" ]; then
  echo "Usage: deploy.sh <image_uri>"
  exit 1
fi

echo "=== Deploying $IMAGE_URI ==="
cd ~/app

# Refresh ECR auth — extract registry from image URI
aws ecr get-login-password --region eu-west-1 | \
  docker login --username AWS --password-stdin \
  "$(echo $IMAGE_URI | cut -d'/' -f1)"

# Pull new image
echo "--- Pulling image ---"
docker pull "$IMAGE_URI"

# Load credentials for docker-compose environment
echo "--- Loading credentials from SSM ---"

export POSTGRES_USER=$(aws ssm get-parameter \
  --name "/ttt/prod/POSTGRES_USER" --region eu-west-1 \
  --query "Parameter.Value" --output text)

export POSTGRES_PASSWORD=$(aws ssm get-parameter \
  --name "/ttt/prod/POSTGRES_PASSWORD" --with-decryption --region eu-west-1 \
  --query "Parameter.Value" --output text)

export POSTGRES_DB=$(aws ssm get-parameter \
  --name "/ttt/prod/POSTGRES_DB" --region eu-west-1 \
  --query "Parameter.Value" --output text)

export REDIS_PASSWORD=$(aws ssm get-parameter \
  --name "/ttt/prod/REDIS_PASSWORD" --with-decryption --region eu-west-1 \
  --query "Parameter.Value" --output text)

export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"\

# Update app container only — postgres and redis keep running
echo "--- Updating app container ---"
export APP_IMAGE="$IMAGE_URI"
docker compose up -d

echo "--- Waiting for health check ---"
timeout 60 bash -c 'until docker compose ps app | grep -q "healthy"; do sleep 2; done'

echo "--- Cleaning up old images ---"
docker image prune -f

echo "=== Deploy complete ==="
docker compose ps
