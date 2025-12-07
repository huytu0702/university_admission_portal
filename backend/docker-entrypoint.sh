#!/bin/sh
set -e

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "🌱 Seeding feature flags if needed..."
npx prisma db seed || true

echo "🚀 Starting application..."
exec dumb-init node dist/src/main
