#!/bin/sh
set -eu

# Fetch all parameters under /ttt/prod/ in one API call and export them.
# Writing to a temp file avoids the subshell scope issue with piped while loops
# (variables set inside a pipe are lost when the pipe closes).
_env_file=$(mktemp)

aws ssm get-parameters-by-path \
  --path "/ttt/prod/" \
  --with-decryption \
  --region "${AWS_REGION:-eu-west-1}" \
  --query "Parameters[].[Name,Value]" \
  --output text \
  | while IFS=$(printf '\t') read -r name value; do
      key=$(echo "$name" | sed 's|.*/||')
      # Single-quote the value and escape any single quotes inside it
      safe_value=$(echo "$value" | sed "s/'/'\\\\''/g")
      echo "export ${key}='${safe_value}'"
    done > "$_env_file"

# shellcheck source=/dev/null
. "$_env_file"
rm -f "$_env_file"

export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"

npx prisma migrate deploy

exec node dist/src/main.js
