#!/bin/sh
set -e

echo "⏳ Waiting for database to be ready..."
until nc -z postgres 5432; do
  sleep 1
done
echo "✅ Database is ready"

echo "🔄 Running database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "🚀 Starting application..."
exec "$@"
