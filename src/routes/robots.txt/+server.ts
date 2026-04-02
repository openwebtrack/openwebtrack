import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const enableIndexing = env.ENABLE_INDEXING === 'true';

	const robots = enableIndexing
		? `User-agent: *
Allow: /
`
		: `User-agent: *
Disallow: /
`;

	return new Response(robots, {
		headers: {
			'Content-Type': 'text/plain'
		}
	});
};
