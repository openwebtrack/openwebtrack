<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { X, Monitor, Smartphone, Globe, Users, MousePointerClick } from 'lucide-svelte';
	import Logo from '$lib/components/Logo.svelte';
	import maplibregl from 'maplibre-gl';

	interface VisitorItem {
		visitorId: string;
		avatar: string;
		name: string;
		isCustomer: boolean;
		countryFlag: string;
		country: string;
		device: string;
		osIcon: string;
		os: string;
		browserIcon: string;
		browser: string;
		sourceIcon: string;
		source: string;
		lastSeen: string;
		lastActivityAt: string;
		region: string | null;
		city: string | null;
		screenWidth: number | null;
		screenHeight: number | null;
		isPwa: boolean | null;
	}

	interface EventItem {
		id: number;
		type: string;
		name: string;
		data: any;
		timestamp: string;
		formattedTime: string;
		visitor: {
			id: string;
			name: string;
			avatar: string;
			country: string;
			countryFlag: string;
			city: string | null;
		};
	}

	interface Props {
		visitors: VisitorItem[];
		events: EventItem[];
		websiteDomain: string;
		onlineCount?: number;
		onClose: () => void;
	}

	let { visitors, events, websiteDomain, onlineCount = 0, onClose }: Props = $props();

	// Country centroid coordinates [lng, lat]
	const countryCoords: Record<string, [number, number]> = {
		Afghanistan: [67.709953, 33.93911],
		Albania: [20.168331, 41.153332],
		Algeria: [1.659626, 28.033886],
		Angola: [17.873887, -11.202692],
		Argentina: [-63.616672, -38.416097],
		Armenia: [45.038189, 40.069099],
		Australia: [133.775136, -25.274398],
		Austria: [14.550072, 47.516231],
		Azerbaijan: [47.576927, 40.143105],
		Bahrain: [50.637772, 26.0275],
		Bangladesh: [90.356331, 23.684994],
		Belarus: [27.953389, 53.709807],
		Belgium: [4.469936, 50.503887],
		Bolivia: [-64.9909854, -16.290154],
		Bosnia: [17.679076, 43.915886],
		Brazil: [-51.92528, -14.235004],
		Bulgaria: [25.48583, 42.733883],
		Cambodia: [104.990963, 12.565679],
		Cameroon: [12.354722, 3.848033],
		Canada: [-96.821582, 56.130366],
		Chile: [-71.542969, -35.675147],
		China: [104.195397, 35.86166],
		Colombia: [-74.297333, 4.570868],
		Croatia: [15.2, 45.1],
		Cuba: [-77.781167, 21.521757],
		'Czech Republic': [15.472962, 49.817492],
		Czechia: [15.472962, 49.817492],
		Denmark: [9.501785, 56.26392],
		Ecuador: [-78.183406, -1.831239],
		Egypt: [30.802498, 26.820553],
		Ethiopia: [40.489673, 9.145],
		Finland: [25.748151, 61.92411],
		France: [2.213749, 46.227638],
		Georgia: [43.356892, 42.315407],
		Germany: [10.451526, 51.165691],
		Ghana: [-1.023194, 7.946527],
		Greece: [21.824312, 39.074208],
		Guatemala: [-90.230759, 15.783471],
		Honduras: [-86.241905, 15.199999],
		Hungary: [19.503304, 47.162494],
		India: [78.96288, 20.593684],
		Indonesia: [113.921327, -0.789275],
		Iran: [53.688046, 32.427908],
		Iraq: [43.679291, 33.223191],
		Ireland: [-8.24389, 53.41291],
		Israel: [34.851612, 31.046051],
		Italy: [12.56738, 41.87194],
		Japan: [138.252924, 36.204824],
		Jordan: [36.238414, 30.585164],
		Kazakhstan: [66.923684, 48.019573],
		Kenya: [37.906193, -0.023559],
		Kuwait: [47.481766, 29.31166],
		Libya: [17.228331, 26.3351],
		Lithuania: [23.881275, 55.169438],
		Luxembourg: [6.129583, 49.815273],
		Malaysia: [101.975766, 4.210484],
		Mexico: [-102.552784, 23.634501],
		Morocco: [-7.09262, 31.791702],
		Netherlands: [5.291266, 52.132633],
		'New Zealand': [174.885971, -40.900557],
		Nigeria: [8.675277, 9.081999],
		Norway: [8.468946, 60.472024],
		Pakistan: [69.345116, 30.375321],
		Peru: [-75.015152, -9.189967],
		Philippines: [121.774017, 12.879721],
		Poland: [19.145136, 51.919438],
		Portugal: [-8.224454, 39.399872],
		Qatar: [51.183884, 25.354826],
		Romania: [24.96676, 45.943161],
		Russia: [105.318756, 61.52401],
		'Saudi Arabia': [45.079162, 23.885942],
		Serbia: [21.005859, 44.016521],
		Singapore: [103.819836, 1.352083],
		Slovakia: [19.699024, 48.669026],
		Slovenia: [14.995463, 46.151241],
		'South Africa': [22.937506, -30.559482],
		'South Korea': [127.766922, 35.907757],
		Spain: [-3.74922, 40.463667],
		Sweden: [18.643501, 60.128161],
		Switzerland: [8.227512, 46.818188],
		Syria: [38.996815, 34.802075],
		Taiwan: [120.960515, 23.69781],
		Thailand: [100.992541, 15.870032],
		Tunisia: [9.537499, 33.886917],
		Turkey: [35.243322, 38.963745],
		Türkiye: [35.243322, 38.963745],
		Ukraine: [31.16558, 48.379433],
		'United Arab Emirates': [53.847818, 23.424076],
		'United Kingdom': [-3.435973, 55.378051],
		UK: [-3.435973, 55.378051],
		'United States': [-95.712891, 37.09024],
		USA: [-95.712891, 37.09024],
		Uruguay: [-55.765835, -32.522779],
		Uzbekistan: [64.585262, 41.377491],
		Venezuela: [-66.58973, 6.42375],
		Vietnam: [108.277199, 14.058324],
		Yemen: [48.516388, 15.552727],
		Zimbabwe: [29.154857, -19.015438]
	};

	function getCoords(visitor: VisitorItem): [number, number] | null {
		const country = visitor.country;
		if (!country || country === 'Unknown') return null;
		if (countryCoords[country]) return countryCoords[country];
		const key = Object.keys(countryCoords).find((k) => k.toLowerCase() === country.toLowerCase());
		return key ? countryCoords[key] : null;
	}

	let effectiveVisitors = $derived(
		visitors.filter((v) => {
			if (!v.lastActivityAt) return false;
			try {
				const lastActivity = new Date(v.lastActivityAt).getTime();
				if (isNaN(lastActivity)) return false;
				const now = Date.now();
				const fiveMinutes = 5 * 60 * 1000;
				return now - lastActivity <= fiveMinutes;
			} catch {
				return false;
			}
		})
	);

	let referrerCounts = $derived(() => {
		const map: Record<string, number> = {};
		for (const v of effectiveVisitors) {
			const key = v.source || 'Direct';
			map[key] = (map[key] || 0) + 1;
		}
		return Object.entries(map)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 4);
	});

	let countryCounts = $derived(() => {
		const map: Record<string, { count: number; flag: string }> = {};
		for (const v of effectiveVisitors) {
			const key = v.country || 'Unknown';
			if (!map[key]) map[key] = { count: 0, flag: v.countryFlag };
			map[key].count++;
		}
		return Object.entries(map)
			.sort((a, b) => b[1].count - a[1].count)
			.slice(0, 4)
			.map(([country, { count, flag }]) => ({ country, count, flag }));
	});

	let deviceCounts = $derived(() => {
		const map: Record<string, number> = {};
		for (const v of effectiveVisitors) {
			const key = v.device || 'Desktop';
			map[key] = (map[key] || 0) + 1;
		}
		return Object.entries(map)
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);
	});

	let recentEvents = $derived(events.slice(0, 8));

	let mapContainer: HTMLDivElement;
	let map: maplibregl.Map | null = null;
	let markerData: Array<{ element: HTMLElement; lng: number; lat: number; popup: maplibregl.Popup }> = [];
	let activePopup: maplibregl.Popup | null = null;

	function clearMarkers() {
		for (const { element, popup } of markerData) {
			element.remove();
			popup.remove();
		}
		markerData = [];
		activePopup = null;
	}

	function getHemisphereVisibility(lng: number, lat: number): number {
		if (!map) return 1;
		const center = map.getCenter();
		const λ1 = (center.lng * Math.PI) / 180;
		const φ1 = (center.lat * Math.PI) / 180;
		const λ2 = (lng * Math.PI) / 180;
		const φ2 = (lat * Math.PI) / 180;
		const dot = Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
		if (dot <= 0.15) return 0;
		if (dot >= 0.5) return 1;
		return (dot - 0.15) / (0.5 - 0.15);
	}

	function updateMarkerPositions() {
		if (!map) return;
		const container = map.getContainer();
		const containerRect = container.getBoundingClientRect();

		for (const { element, lng, lat, popup } of markerData) {
			const opacity = getHemisphereVisibility(lng, lat);
			if (opacity <= 0) {
				element.style.display = 'none';
				popup.remove();
				continue;
			}

			const point = map.project([lng, lat]);
			const margin = 50;
			if (point.x < -margin || point.x > containerRect.width + margin || point.y < -margin || point.y > containerRect.height + margin) {
				element.style.display = 'none';
				popup.remove();
				continue;
			}

			element.style.display = 'block';
			element.style.opacity = String(opacity);
			element.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
			element.style.left = '0';
			element.style.top = '0';
		}
	}

	function addVisitorMarkers() {
		if (!map) return;
		clearMarkers();

		const mapContainerEl = map.getContainer();
		const countryCount: Record<string, number> = {};
		const countryIndex: Record<string, number> = {};

		for (const visitor of effectiveVisitors) {
			const country = visitor.country || 'Unknown';
			countryCount[country] = (countryCount[country] || 0) + 1;
		}

		for (const visitor of effectiveVisitors) {
			const coords = getCoords(visitor);
			if (!coords) continue;

			const [baseLng, baseLat] = coords;
			const country = visitor.country || 'Unknown';
			const totalInCountry = countryCount[country];
			const indexInCountry = countryIndex[country] || 0;
			countryIndex[country] = indexInCountry + 1;

			let lng = baseLng;
			let lat = baseLat;

			if (totalInCountry > 1) {
				const radius = 1.2 + Math.sqrt(totalInCountry) * 0.4;
				const angle = (indexInCountry / totalInCountry) * Math.PI * 2;
				lng += Math.cos(angle) * radius;
				lat += Math.sin(angle) * radius * 0.6;
			}

			lng = Math.max(-180, Math.min(180, lng));
			lat = Math.max(-85, Math.min(85, lat));

			const el = document.createElement('div');
			el.className = 'visitor-marker';
			el.innerHTML = `
                <div class="marker-inner">
                    <img src="${visitor.avatar}" alt="${visitor.name}" />
                </div>
                <div class="marker-pulse"></div>
            `;

			const popup = new maplibregl.Popup({
				offset: 16,
				closeButton: false,
				className: 'visitor-popup'
			}).setHTML(`
                <div class="popup-inner">
                    <div class="popup-header">
                        <img src="${visitor.avatar}" class="popup-avatar" />
                        <span class="popup-name">${visitor.name}</span>
                    </div>
                    <div class="popup-row">
                        ${visitor.countryFlag ? `<img src="${visitor.countryFlag}" class="popup-flag" />` : ''}
                        <span>${visitor.city ? visitor.city + ', ' : ''}${visitor.country}</span>
                    </div>
                    <div class="popup-row">
                        <span class="popup-label">Device:</span> <span>${visitor.device}</span>
                    </div>
                    <div class="popup-row">
                        <img src="${visitor.sourceIcon}" class="popup-icon" onerror="this.style.display='none'" />
                        <span>${visitor.source}</span>
                    </div>
                </div>
            `);

			el.addEventListener('click', (e) => {
				e.stopPropagation();
				const opacity = getHemisphereVisibility(lng, lat);
				if (opacity <= 0) return;
				if (activePopup && activePopup !== popup) {
					activePopup.remove();
				}
				popup.setLngLat([lng, lat]).addTo(map!);
				activePopup = popup;
			});

			mapContainerEl.appendChild(el);
			markerData.push({ element: el, lng, lat, popup });
		}

		updateMarkerPositions();
	}

	onMount(() => {
		// ✅ No API token needed — OpenFreeMap is fully free & open source
		map = new maplibregl.Map({
			container: mapContainer,
			style: 'https://tiles.openfreemap.org/styles/dark',
			// MapLibre globe projection — set directly in style or via map options
			zoom: 1.5,
			center: [10, 25],
			attributionControl: false
		});

		// Enable globe projection after map loads
		map.on('load', () => {
			if (!map) return;

			// Set globe projection
			map.setProjection({ type: 'globe' });

			// Space/atmosphere fog — uses MapLibre's sky spec
			map.setSky({
				'sky-color': '#0a0806',
				'sky-horizon-blend': 0.5,
				'horizon-color': '#1c160e',
				'horizon-fog-blend': 0.1,
				'fog-color': '#12100c',
				'fog-ground-blend': 0.9
			});

			addVisitorMarkers();
		});

		map.on('render', updateMarkerPositions);

		let rotateId: ReturnType<typeof setInterval>;
		let userInteracting = false;

		map.on('mousedown', () => {
			userInteracting = true;
		});
		map.on('mouseup', () => {
			userInteracting = false;
		});

		const spinGlobe = () => {
			if (!map || userInteracting) return;
			const center = map.getCenter();
			center.lng -= 0.15;
			map.easeTo({ center, duration: 100, easing: (n) => n });
		};
		rotateId = setInterval(spinGlobe, 100);

		return () => {
			clearInterval(rotateId);
		};
	});

	onDestroy(() => {
		clearMarkers();
		map?.remove();
		map = null;
	});

	$effect(() => {
		if (map && effectiveVisitors) {
			const loaded = map.isStyleLoaded();
			if (loaded) addVisitorMarkers();
		}
	});

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Fullscreen overlay -->
<div class="fixed inset-0 z-50 h-screen w-screen overflow-hidden bg-[#12100c]" role="dialog" aria-modal="true" aria-label="Real-time visitor map" transition:fade={{ duration: 300 }}>
	<!-- Map — full bleed -->
	<div bind:this={mapContainer} class="absolute inset-0 h-screen w-screen"></div>

	<!-- Close button -->
	<button
		onclick={onClose}
		class="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white"
		aria-label="Close map"
	>
		<X class="h-4 w-4" />
	</button>

	<!-- Top-left header pill -->
	<div class="absolute top-4 left-4 z-10 flex items-center gap-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
		<span class="flex h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_6px_#4ade80]"></span>
		<img src="https://icons.duckduckgo.com/ip3/{websiteDomain}.ico" alt={websiteDomain} class="h-4 w-4 rounded" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
		<span class="text-sm font-semibold text-white">{websiteDomain}</span>
		<div class="mx-1 h-3.5 w-px bg-white/20"></div>
		<Users class="h-3.5 w-3.5" style="color: var(--chart-1)" />
		<span class="text-sm text-white/80"><span class="font-bold text-white">{effectiveVisitors.length}</span> online</span>
	</div>

	<!-- Top-left stats column -->
	<div class="absolute top-16 left-4 z-10 flex w-56 flex-col gap-2">
		<div class="rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
			<div class="mb-1.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">Referrers</div>
			<div class="flex flex-col gap-1">
				{#if referrerCounts().length === 0}
					<div class="flex items-center gap-2">
						<span class="text-xs text-white/50">No referrer data</span>
					</div>
				{/if}

				{#each referrerCounts() as [source, count]}
					<div class="flex items-center gap-2">
						<img
							src="https://icons.duckduckgo.com/ip3/{source}.ico"
							alt={source}
							class="h-3 w-3 shrink-0 rounded-sm"
							onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
						/>
						<span class="max-w-28 truncate text-xs text-white/70">{source}</span>
						<span class="ml-auto text-xs font-semibold text-white">({count})</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
			<div class="mb-1.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">Countries</div>
			<div class="flex flex-col gap-1">
				{#if countryCounts().length === 0}
					<div class="flex items-center gap-2">
						<span class="text-xs text-white/50">No country data</span>
					</div>
				{/if}

				{#each countryCounts() as { country, count, flag }}
					<div class="flex items-center gap-2">
						{#if flag}
							<img src={flag} alt={country} class="h-3 w-4 shrink-0 rounded-[2px]" />
						{:else}
							<Globe class="h-3 w-3 shrink-0 text-white/40" />
						{/if}
						<span class="max-w-28 truncate text-xs text-white/70">{country}</span>
						<span class="ml-auto text-xs font-semibold text-white">({count})</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="rounded-xl border border-white/10 bg-black/50 px-3 py-2 backdrop-blur-md">
			<div class="mb-1.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">Devices</div>
			<div class="flex flex-col gap-1">
				{#if deviceCounts().length === 0}
					<div class="flex items-center gap-2">
						<span class="text-xs text-white/50">No device data</span>
					</div>
				{/if}

				{#each deviceCounts() as [device, count]}
					<div class="flex items-center gap-2">
						{#if device?.toLowerCase().includes('mobile') || device?.toLowerCase().includes('phone')}
							<Smartphone class="h-3 w-3 shrink-0 text-white/60" />
						{:else}
							<Monitor class="h-3 w-3 shrink-0 text-white/60" />
						{/if}
						<span class="text-xs text-white/70">{device}</span>
						<span class="ml-auto text-xs font-semibold text-white">({count})</span>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Bottom-left live feed -->
	<div class="absolute bottom-4 left-4 z-10 w-64">
		<div class="rounded-xl border border-white/10 bg-black/50 p-3 backdrop-blur-md">
			<div class="mb-2 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-white/40 uppercase">
				<MousePointerClick class="h-3 w-3" />
				Live activity
			</div>
			<div class="flex max-h-44 flex-col gap-2 overflow-y-auto">
				{#if recentEvents.length === 0}
					<div class="flex items-center gap-2">
						<span class="text-xs text-white/50">No recent activity</span>
					</div>
				{/if}

				{#each recentEvents as event (event.id)}
					<div class="flex items-start gap-2">
						<img src={event.visitor.avatar} alt={event.visitor.name} class="mt-0.5 h-6 w-6 shrink-0 rounded-full" />
						<div class="min-w-0">
							<div class="flex items-center gap-1.5">
								{#if event.visitor.countryFlag}
									<img src={event.visitor.countryFlag} alt={event.visitor.country} class="h-2.5 w-3.5 rounded-[2px]" />
								{/if}
								<span class="truncate text-xs font-medium text-white/80">{event.visitor.name}</span>
							</div>
							<div class="truncate text-[11px] text-white/40">
								{#if event.type === 'pageview'}
									visited {event.name}
								{:else}
									{event.name || event.type}
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Bottom-right OpenWebTrack branding -->
	<div class="absolute right-4 bottom-4 z-10">
		<a href="https://openwebtrack.github.io/" target="_blank" class="flex items-center gap-3">
			<Logo class="h-6 w-6 text-primary" />
			<span class="text-sm font-bold tracking-tight">OpenWebTrack</span>
		</a>
	</div>
</div>

<style>
	:global(.visitor-marker) {
		position: absolute;
		top: 0;
		left: 0;
		width: 36px;
		height: 36px;
		cursor: pointer;
		transform-origin: center center;
		will-change: transform;
		pointer-events: auto;
		z-index: 100;
	}

	:global(.marker-inner) {
		position: relative;
		z-index: 2;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		overflow: hidden;
		background: var(--color-secondary);
		border: 2px solid color-mix(in oklch, var(--chart-1) 80%, transparent);
		box-shadow: 0 0 10px color-mix(in oklch, var(--chart-1) 45%, transparent);
		transition: transform 0.2s;
	}

	:global(.visitor-marker:hover .marker-inner) {
		transform: scale(1.15);
		border-color: var(--chart-1);
		box-shadow: 0 0 18px color-mix(in oklch, var(--chart-1) 80%, transparent);
	}

	:global(.marker-inner img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	:global(.marker-pulse) {
		position: absolute;
		inset: -4px;
		border-radius: 50%;
		border: 2px solid color-mix(in oklch, var(--chart-1) 50%, transparent);
		animation: pulse-ring 2s ease-out infinite;
	}

	@keyframes pulse-ring {
		0% {
			transform: scale(0.85);
			opacity: 0.8;
		}
		70% {
			transform: scale(1.3);
			opacity: 0;
		}
		100% {
			transform: scale(1.3);
			opacity: 0;
		}
	}

	:global(.visitor-popup .maplibregl-popup-content) {
		background: color-mix(in oklch, var(--card) 92%, transparent);
		border: 1px solid color-mix(in oklch, var(--border) 60%, transparent);
		border-radius: 12px;
		padding: 10px 12px;
		color: var(--card-foreground);
		font-family: inherit;
		min-width: 160px;
		backdrop-filter: blur(12px);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
		z-index: 200;
	}

	:global(.maplibregl-popup) {
		z-index: 200;
	}

	:global(.visitor-popup .maplibregl-popup-tip) {
		border-top-color: color-mix(in oklch, var(--card) 92%, transparent) !important;
	}

	:global(.popup-inner) {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.popup-header) {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 2px;
	}

	:global(.popup-avatar) {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		border: 1px solid rgba(255, 255, 255, 0.3);
	}

	:global(.popup-name) {
		font-size: 13px;
		font-weight: 600;
		color: var(--card-foreground);
	}

	:global(.popup-row) {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--muted-foreground);
	}

	:global(.popup-flag) {
		width: 16px;
		height: 12px;
		border-radius: 2px;
	}

	:global(.popup-icon) {
		width: 14px;
		height: 14px;
		border-radius: 2px;
	}

	:global(.popup-label) {
		color: rgba(255, 255, 255, 0.4);
	}

	:global(.maplibregl-ctrl-logo) {
		display: none !important;
	}
</style>
