import adapter_vercel from '@sveltejs/adapter-vercel';
import adapter_node from '@sveltejs/adapter-node';

const adapter = process.env.VERCEL ? adapter_vercel : adapter_node;

/** @type {import('@sveltejs/kit').Config} */
const config = { kit: { adapter: adapter(), alias: { '@/*': './src/lib/*' } } };

export default config;
