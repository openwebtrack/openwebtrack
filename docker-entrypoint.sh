#!/bin/sh
set -e

echo "Waiting for database to be ready..."

DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
    until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
        echo "Database not ready yet, retrying in 2 seconds..."
        sleep 2
    done
    echo "Database is ready!"
else
    echo "Could not parse DATABASE_URL, proceeding anyway..."
fi

echo "Running database migrations..."
npx drizzle-kit push

echo "Starting application..."
exec node build
