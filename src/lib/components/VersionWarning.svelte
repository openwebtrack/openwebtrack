<script lang="ts">
	import { XIcon } from 'lucide-svelte';
	import { Badge } from './ui/badge';
	import { onMount } from 'svelte';
	import axios from 'axios';

	let visible = $state(true);
	let latestVersion = $state('');
	let updateAvailable = $state(false);

	const isNewerVersion = (latest: string, current: string): boolean => {
		const [latMaj, latMin, latPat] = latest.split('.').map(Number);
		const [curMaj, curMin, curPat] = current.split('.').map(Number);

		return latMaj > curMaj || (latMaj === curMaj && latMin > curMin) || (latMaj === curMaj && latMin === curMin && latPat > curPat);
	};

	onMount(async () => {
		try {
			const { data } = await axios.get('https://raw.githubusercontent.com/openwebtrack/openwebtrack/refs/heads/main/package.json');
			latestVersion = data.version;
			updateAvailable = isNewerVersion(latestVersion, APP_VERSION);
		} catch {
			latestVersion = APP_VERSION;
		}
	});
</script>

{#if visible && updateAvailable}
	<Badge class="fixed right-4 bottom-4 z-20 flex cursor-pointer items-center gap-1" onclick={() => (visible = false)}>
		Version {latestVersion} available!
		<XIcon class="size-4" />
	</Badge>
{/if}
