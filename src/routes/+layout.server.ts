import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';

export const load: LayoutServerLoad = async () => {
	return {
		enableIndexing: env.ENABLE_INDEXING === 'true'
	};
};
