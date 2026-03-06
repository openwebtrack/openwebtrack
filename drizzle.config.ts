import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dbCredentials: { url: process.env.DATABASE_URL || 'postgresql://placeholder' },
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql'
});
