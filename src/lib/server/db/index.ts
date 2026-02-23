import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '$env/dynamic/private';
import * as schema from './schema';
import postgres from 'postgres';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function getDb() {
	if (!_db) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
		_client = postgres(env.DATABASE_URL, {
			max: 10,
			idle_timeout: 20,
			connect_timeout: 10
		});
		_db = drizzle(_client, { schema });
	}
	return _db;
}

const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
	get(_, prop) {
		return Reflect.get(getDb(), prop);
	}
});

export default db;
