import { defineConfig, type ResolvedConfig, type ViteDevServer } from 'vite';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import { build } from 'esbuild';
import { join } from 'path';

const trackingScriptPlugin = () => {
	let isDev = false;

	return {
		name: 'tracking-script-plugin',
		configResolved(config: ResolvedConfig) {
			isDev = config.mode === 'development';
		},
		async buildStart() {
			const outDir = isDev ? 'static' : 'static';
			const outFile = join(outDir, 'script.js');

			if (!existsSync(outDir)) {
				mkdirSync(outDir, { recursive: true });
			}

			try {
				await build({
					entryPoints: ['src/script.ts'],
					outfile: outFile,
					minify: !isDev,
					bundle: true,
					format: 'iife',
					globalName: 'owt',
					target: 'es2018',
					platform: 'browser',
					define: isDev ? {} : { __OWT_API_ENDPOINT__: '""' }
				});
			} catch (e) {
				console.error('Failed to build tracking script:', e);
			}
		},
		configureServer(server: ViteDevServer) {
			server.watcher.on('change', (file: string) => {
				if (file.includes('script.ts')) {
					this.buildStart();
				}
			});
		}
	};
};

const file = fileURLToPath(new URL('package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(file, 'utf8'));

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), trackingScriptPlugin()],
	server: { port: 8424 },
	define: { APP_VERSION: JSON.stringify(pkg.version) }
});
