import { env } from '$env/dynamic/public';

export const SAAS_MODE = env.PUBLIC_SAAS_MODE === 'true';