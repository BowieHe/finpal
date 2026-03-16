#!/bin/sh
set -e

echo "⏳ Waiting for database to be ready..."
until nc -z postgres 5432; do
  sleep 1
done
echo "✅ Database is ready"

echo "🚀 Starting application..."
exec "$@"
