#!/bin/sh
set -e

if [ -n "$DATABASE_URL" ]; then
  echo "entrypoint: applying database migrations"
  node ./node_modules/lyzr-architect-pg/bin/lyzr-pg-migrate.mjs
  echo "entrypoint: migrations complete"
else
  echo "entrypoint: DATABASE_URL not set — skipping migrations (app has no database)"
fi

exec "$@"
