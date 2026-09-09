<script lang="ts">
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Copy, Check, ExternalLink, RotateCcw } from 'lucide-svelte';
	import { SITE_URL } from '$lib/config.js';

	let { data } = $props();
	let websiteId = $derived(data.website.id);

	let showGraph = $state(true);
	let showCountries = $state(true);
	// Website theme defaults: warm tan primary + dark card background
	// (matches https://openwebtrack.one tokens: --primary #c2956a, --card #212121)
	let primaryColor = $state('#c2956a');
	let bgColor = $state('#212121');

	let copied = $state(false);

	let widgetUrl = $derived.by(() => {
		const baseUrl = `${SITE_URL}/widget/${websiteId}`;
		const params = new URLSearchParams();
		if (!showGraph) params.set('graph', 'false');
		if (!showCountries) params.set('countries', 'false');
		if (primaryColor !== '#c2956a') params.set('primary', primaryColor);
		if (bgColor !== '#212121') params.set('bg', bgColor);
		const qs = params.toString();
		return qs ? `${baseUrl}?${qs}` : baseUrl;
	});

	let iframeCode = $derived(`<iframe 
  src="${widgetUrl}" 
  width="300" 
  height="450" 
  frameborder="0" 
  loading="lazy"
  style="border-radius: 1rem; overflow: hidden; background-color: transparent;"
></iframe>`);

	function copyToClipboard() {
		navigator.clipboard.writeText(iframeCode);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function resetSettings() {
		showGraph = true;
		showCountries = true;
		primaryColor = '#c2956a';
		bgColor = '#212121';
	}
</script>

<div class="space-y-6">
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div class="space-y-1.5">
					<CardTitle>Widget</CardTitle>
					<CardDescription>Embed a real-time visitor widget on your website or dashboard.</CardDescription>
				</div>
				<Button variant="outline" size="sm" onclick={resetSettings} class="gap-2">
					<RotateCcw size={16} />
					Reset
				</Button>
			</div>
		</CardHeader>
		<CardContent class="grid gap-8 md:grid-cols-2">
			<div class="space-y-6">
				<div class="space-y-4">
					<div class="flex items-center justify-between">
						<Label for="show-graph">Show Graph</Label>
						<Switch id="show-graph" checked={showGraph} onCheckedChange={(checked) => (showGraph = checked)} />
					</div>
					<div class="flex items-center justify-between">
						<Label for="show-countries">Show Countries</Label>
						<Switch id="show-countries" checked={showCountries} onCheckedChange={(checked) => (showCountries = checked)} />
					</div>
					<div class="flex items-center justify-between">
						<Label for="primary-color">Primary Color</Label>
						<input type="color" id="primary-color" bind:value={primaryColor} class="size-8 cursor-pointer rounded-full border-none bg-transparent outline-none" />
					</div>
					<div class="flex items-center justify-between">
						<Label for="bg-color">Background Color</Label>
						<input type="color" id="bg-color" bind:value={bgColor} class="size-8 cursor-pointer rounded-full border-none bg-transparent outline-none" />
					</div>
				</div>

				<div class="space-y-2">
					<Label>Embed Code</Label>
					<div class="relative">
						<pre class="overflow-x-auto rounded-lg border bg-[#141414] p-4 text-xs text-foreground/80"><code>{iframeCode}</code></pre>
						<Button size="icon" variant="ghost" class="absolute top-2 right-2" onclick={copyToClipboard}>
							{#if copied}
								<Check size={16} class="text-emerald-500" />
							{:else}
								<Copy size={16} />
							{/if}
						</Button>
					</div>
				</div>
			</div>

			<div class="flex flex-col items-center justify-center space-y-4 rounded-xl border border-dashed p-8">
				<p class="text-sm text-muted-foreground">Preview</p>
				<div class="relative h-fit w-[300px]">
					<iframe src={widgetUrl} class="h-[370px] w-[325px] max-w-full bg-transparent"></iframe>
				</div>
			</div>
		</CardContent>
	</Card>
</div>
