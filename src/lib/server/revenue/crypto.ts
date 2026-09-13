import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1';

function getKey(): Buffer {
	const secret = env.AUTH_SECRET;
	if (!secret) throw new Error('AUTH_SECRET is required to store Stripe credentials');
	return createHash('sha256').update(secret).digest();
}

/** Encrypt a secret (Stripe API key / webhook secret) for DB storage. */
export function encryptSecret(plain: string): string {
	const key = getKey();
	const iv = randomBytes(12);
	const cipher = createCipheriv(ALGO, key, iv);
	const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Decrypt a value produced by {@link encryptSecret}. */
export function decryptSecret(enc: string): string {
	const key = getKey();
	const parts = enc.split(':');
	if (parts.length !== 4 || parts[0] !== PREFIX) throw new Error('Unsupported encrypted payload version');
	const iv = Buffer.from(parts[1], 'base64');
	const tag = Buffer.from(parts[2], 'base64');
	const ciphertext = Buffer.from(parts[3], 'base64');
	const decipher = createDecipheriv(ALGO, key, iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function maskKeyLast4(key: string): string {
	const clean = key.trim();
	return clean.length <= 4 ? '****' : clean.slice(-4);
}
