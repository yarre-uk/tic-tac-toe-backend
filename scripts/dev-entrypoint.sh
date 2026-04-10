#!/bin/sh
set -euxo pipefail

npx prisma migrate deploy

exec yarn start:dev
