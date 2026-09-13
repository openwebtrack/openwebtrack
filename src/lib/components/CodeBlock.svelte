<script lang="ts">
	import hljs from 'highlight.js/lib/core';
	import javascript from 'highlight.js/lib/languages/javascript';
	import typescript from 'highlight.js/lib/languages/typescript';
	import php from 'highlight.js/lib/languages/php';
	import xml from 'highlight.js/lib/languages/xml';
	import 'highlight.js/styles/github-dark.css';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Copy, Check } from 'lucide-svelte';

	if (!hljs.getLanguage('javascript')) hljs.registerLanguage('javascript', javascript);
	if (!hljs.getLanguage('typescript')) hljs.registerLanguage('typescript', typescript);
	if (!hljs.getLanguage('xml')) hljs.registerLanguage('xml', xml);
	if (!hljs.getLanguage('php')) hljs.registerLanguage('php', php);

	let { code, language = 'typescript' }: { code: string; language?: string } = $props();

	let copied = $state(false);

	let highlighted = $derived.by(() => {
		try {
			return hljs.highlight(code, { language }).value;
		} catch {
			return hljs.highlightAuto(code).value;
		}
	});

	const copyCode = async () => {
		await navigator.clipboard.writeText(code);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	};
</script>

<div class="relative rounded-lg border bg-[#141414] p-4 font-mono text-xs">
	<pre class="overflow-x-auto"><code class="hljs bg-transparent p-0">{@html highlighted}</code></pre>
	<Button variant="ghost" size="icon-sm" class="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:bg-white/10 hover:text-foreground" onclick={copyCode} aria-label="Copy code">
		{#if copied}<Check size={14} class="text-green-500" />{:else}<Copy size={14} />{/if}
	</Button>
</div>

<style>
	:global(.hljs) {
		background: transparent;
	}
</style>
