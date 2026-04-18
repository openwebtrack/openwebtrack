import { defineConfig, type ResolvedConfig, type ViteDevServer } from 'vite';
import { existsSync, mkdirSync } from 'fs';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
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

			if (!existsSync(outDir)) {
				mkdirSync(outDir, { recursive: true });
			}

			const scripts = [
				{ entry: 'src/script.ts', outfile: join(outDir, 'script.js') },
				{ entry: 'src/script.cookieless.ts', outfile: join(outDir, 'script.cookieless.js') }
			];

			for (const { entry, outfile } of scripts) {
				try {
					await build({
						entryPoints: [entry],
						outfile,
						minify: !isDev,
						bundle: true,
						format: 'iife',
						target: 'es2018',
						platform: 'browser',
						define: isDev ? {} : { __OWT_API_ENDPOINT__: '""' }
					});
				} catch (e) {
					console.error(`Failed to build tracking script (${entry}):`, e);
				}
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

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), trackingScriptPlugin()],
	server: { port: 8424 }
});
