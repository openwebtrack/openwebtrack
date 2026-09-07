<script lang="ts">
	import { onMount } from 'svelte';
	import { CreditCard, ExternalLink, Loader2, AlertCircle, Check, RefreshCw } from 'lucide-svelte';
	import authClient from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { fade } from 'svelte/transition';

	type Tier = {
		slug: string;
		productId: string;
		name: string;
		price: string;
		featured?: boolean;
		maxWebsites: number;
		maxEventsPerMonth: number;
		maxMembersPerWebsite: number;
		features: string[];
	};
	let { tiers = [] }: { tiers: Tier[] } = $props();

	type CustomerState = {
		activeSubscriptions?: Array<{
			id: string;
			status: string;
			productId?: string;
			product?: { name?: string };
			currentPeriodEnd?: string;
			cancelAtPeriodEnd?: boolean;
			canceledAt?: string | null;
		}>;
		// fallback shape from /customer/state
		[k: string]: unknown;
	};

	let loading = $state(true);
	let error = $state('');
	let customerState = $state<CustomerState | null>(null);
	let entitlement = $state<{
		dashboardLocked: boolean;
		graceDaysRemaining: number | null;
		expiredAt: string | null;
	} | null>(null);
	let actionLoading = $state<string | null>(null);
	let actionError = $state('');
	let actionSuccess = $state('');

	const activeSub = $derived(customerState?.activeSubscriptions?.[0] ?? null);

	const tierByProductId = (productId?: string) => tiers.find((t) => t.productId === productId) ?? null;

	// better-auth polar does not expose productId mapping client-side, so match by slug/name if needed
	const isCurrentTier = (tier: Tier) => {
		if (!activeSub) return false;
		if ((activeSub as { productId?: string }).productId === tier.productId) return true;
		const subProductName = (activeSub.product as { name?: string } | undefined)?.name?.toLowerCase();
		return tier.name.toLowerCase() === subProductName || tier.slug.toLowerCase() === subProductName;
	};

	async function fetchState(showLoading = true) {
		if (showLoading) loading = true;
		error = '';
		try {
			const anyClient = authClient as unknown as {
				customer?: { state?: (opts?: unknown) => Promise<{ data: CustomerState | null; error?: unknown }> };
			};
			let rawError: unknown = null;
			if (anyClient.customer?.state) {
				const res = await anyClient.customer.state();
				if (res.error) rawError = res.error;
				else customerState = (res.data as CustomerState) ?? { activeSubscriptions: [] };
			} else {
				const res = await fetch('/api/auth/customer/state');
				if (!res.ok) rawError = { message: await res.text() };
				else customerState = (await res.json()) as CustomerState;
			}
			if (rawError) {
				const msg = String((rawError as { message?: string })?.message ?? rawError);
				const isNotFound = /ResourceNotFound|Subscriptions list failed|Not found/i.test(msg);
				if (isNotFound) {
					try {
						await fetch('/api/billing/ensure-customer', { method: 'POST' });
					} catch {}
					customerState = { activeSubscriptions: [] };
					// still fetch entitlement for grace
				} else {
					throw new Error(msg);
				}
			}
			// Fetch entitlement for grace/locked banner
			try {
				const r = await fetch('/api/billing/entitlement');
				if (r.ok) {
					const j = await r.json();
					entitlement = j.entitlement
						? {
								dashboardLocked: j.entitlement.dashboardLocked ?? false,
								graceDaysRemaining: j.entitlement.graceDaysRemaining,
								expiredAt: j.entitlement.expiredAt
							}
						: null;
				}
			} catch {}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load billing';
		} finally {
			if (showLoading) loading = false;
		}
	}

	onMount(fetchState);

	async function handleCheckout(slug: string) {
		actionLoading = `checkout-${slug}`;
		actionError = '';
		actionSuccess = '';
		try {
			const anyClient = authClient as unknown as {
				checkout?: (p: { slug: string }) => Promise<{ data?: { url: string }; error?: { message?: string } }>;
			};
			// better-auth polar checkout is exposed at /api/auth/checkout via server plugin
			// try client method first, fallback to fetch
			if (anyClient.checkout) {
				const res = await anyClient.checkout({ slug });
				if (res.error) throw new Error(res.error.message);
				if (res.data?.url) window.location.href = res.data.url;
			} else {
				const res = await fetch('/api/auth/checkout', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ slug })
				});
				const json = await res.json();
				if (!res.ok) throw new Error(json?.message ?? 'Checkout failed');
				if (json.url) window.location.href = json.url;
				else throw new Error('No checkout URL');
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Checkout failed';
		} finally {
			actionLoading = null;
		}
	}

	async function handleSwitch(slug: string) {
		actionLoading = `switch-${slug}`;
		actionError = '';
		actionSuccess = '';
		try {
			const res = await fetch('/api/billing/switch-plan', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ slug })
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.error ?? json?.message ?? 'Switch failed');
			actionSuccess = `Switched to ${slug} successfully. Your plan is now updated.`;
			await fetchState(false);
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Switch failed';
		} finally {
			actionLoading = null;
		}
	}

	async function handlePortal() {
		actionLoading = 'portal';
		actionError = '';
		try {
			const tryPortal = async () => {
				const anyClient = authClient as unknown as {
					customer?: { portal?: () => Promise<{ data?: { url: string }; error?: unknown }> };
				};
				if (anyClient.customer?.portal) {
					const res = await anyClient.customer.portal();
					const url = (res.data as { url?: string } | undefined)?.url;
					if (url) return url;
					if (res.error) throw new Error(String((res.error as { message?: string })?.message ?? 'Portal failed'));
				}
				const res = await fetch('/api/auth/customer/portal', { method: 'POST' });
				const json = await res.json();
				if (!res.ok) throw new Error(json?.message ?? json?.error ?? 'Portal failed');
				if (json.url) return json.url as string;
				throw new Error('Portal failed');
			};
			try {
				const url = await tryPortal();
				window.open(url, '_blank', 'noopener,noreferrer');
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e);
				if (/ResourceNotFound|Not found|portal creation failed/i.test(msg)) {
					await fetch('/api/billing/ensure-customer', { method: 'POST' });
					const url = await tryPortal();
					window.open(url, '_blank', 'noopener,noreferrer');
					return;
				}
				throw e;
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Portal failed';
		} finally {
			actionLoading = null;
		}
	}

	function formatPrice(raw: string) {
		const s = raw.trim();
		// Already contains currency and spacing? e.g. "$7 / month" -> keep
		if (/[€$£]\s*\d/.test(s) && s.includes('/')) return s;
		const m = s.match(/^([€$£]?)\s*([\d.,]+)\s*\/\s*(m|mo|month|y|yr|year)$/i);
		if (!m) return s;
		const currency = m[1] || '€';
		const amount = m[2];
		const interval = m[3].toLowerCase();
		const suffix = interval.startsWith('y') ? '/ year' : '/ month';
		return `${currency}${amount} ${suffix}`;
	}

	function formatDate(d?: string) {
		if (!d) return '-';
		try {
			return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
		} catch {
			return d;
		}
	}
</script>

<div class="space-y-6" in:fade={{ duration: 150 }}>
	{#if entitlement?.dashboardLocked}
		<Alert.Root variant="destructive">
			<AlertCircle size={16} />
			<Alert.Title>Dashboard locked</Alert.Title>
			<Alert.Description>Your subscription expired on {entitlement.expiredAt ? new Date(entitlement.expiredAt).toLocaleDateString() : 'recently'}. Grace period (5 days) has ended. Events are no longer collected and dashboard is unavailable. Subscribe to a plan to restore access — your data is preserved.</Alert.Description>
		</Alert.Root>
	{:else if entitlement && entitlement.graceDaysRemaining !== null && !activeSub}
		<Alert.Root class="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
			<AlertCircle size={16} />
			<Alert.Title>Subscription expired — grace period</Alert.Title>
			<Alert.Description>Events are no longer collected. You have {entitlement.graceDaysRemaining} day{entitlement.graceDaysRemaining !== 1 ? 's' : ''} left before dashboard access is locked. Subscribe again to restore full access before {entitlement.expiredAt ? new Date(new Date(entitlement.expiredAt).getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString() : 'then'}.</Alert.Description>
		</Alert.Root>
	{/if}
	{#if loading}
		<Card.Root>
			<Card.Content class="flex items-center gap-3 py-10">
				<Loader2 class="animate-spin" size={18} />
				<span class="text-sm text-muted-foreground">Loading billing…</span>
			</Card.Content>
		</Card.Root>
	{:else if error}
		<Alert.Root variant="destructive">
			<AlertCircle size={16} />
			<Alert.Title>{error}</Alert.Title>
			<Alert.Description class="mt-2 flex gap-2">
				<Button size="sm" variant="outline" onclick={() => fetchState()} class="gap-2">
					<RefreshCw size={14} /> Retry
				</Button>
			</Alert.Description>
		</Alert.Root>
	{:else}
		{#if actionError}
			<Alert.Root variant="destructive">
				<AlertCircle size={16} />
				<Alert.Title>{actionError}</Alert.Title>
			</Alert.Root>
		{/if}
		{#if actionSuccess}
			<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-500">
				<Check size={16} />
				<Alert.Title>{actionSuccess}</Alert.Title>
			</Alert.Root>
		{/if}

		<!-- Current subscription -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<CreditCard size={18} /> Current plan
				</Card.Title>
				<Card.Description>
					{#if activeSub}
						You are on <span class="font-medium text-foreground">{(activeSub.product as { name?: string })?.name ?? 'Active plan'}</span>
						· Renews {formatDate(activeSub.currentPeriodEnd)}
						{#if activeSub.cancelAtPeriodEnd}
							<span class="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">Cancels at period end</span>
						{/if}
					{:else}
						No active subscription. Choose a plan below.
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-wrap gap-2">
				<Button variant="outline" onclick={() => fetchState()} class="gap-2">
					<RefreshCw size={14} /> Refresh
				</Button>
			</Card.Content>
		</Card.Root>

		<!-- Plans -->
		<div class="grid gap-4 md:grid-cols-2">
			{#each tiers as tier (tier.slug)}
				<Card.Root class={tier.featured ? 'border-primary ring-1 ring-primary/20' : ''}>
					<Card.Header>
						<Card.Title class="flex items-center justify-between">
							<span>{tier.name}</span>
							{#if isCurrentTier(tier)}
								<span class="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-600">Current</span>
							{:else if tier.featured}
								<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Popular</span>
							{/if}
						</Card.Title>
						<Card.Description class="flex items-baseline gap-1 text-2xl font-bold text-foreground">
							<span>{formatPrice(tier.price).split(' / ')[0]}</span>
							<span class="text-sm font-normal text-muted-foreground">/ {formatPrice(tier.price).split(' / ')[1] ?? 'month'}</span>
						</Card.Description>
					</Card.Header>
					<Card.Content class="space-y-3">
						<ul class="space-y-2 text-sm">
							{#each tier.features as feat}
								<li class="flex items-start gap-2 text-muted-foreground">
									<Check size={14} class="mt-0.5 shrink-0 text-green-600" />
									<span>{feat}</span>
								</li>
							{/each}
						</ul>
						{#if isCurrentTier(tier)}
							<Button variant="secondary" disabled class="w-full gap-2">
								<Check size={14} /> Active
							</Button>
						{:else if activeSub}
							<Button
								onclick={() => handleSwitch(tier.slug)}
								disabled={actionLoading === `switch-${tier.slug}`}
								class="w-full gap-2"
							>
								{#if actionLoading === `switch-${tier.slug}`}
									<Loader2 size={14} class="animate-spin" />
								{/if}
								Switch to {tier.name}
							</Button>
							<p class="mt-2 text-xs text-muted-foreground">Your plan will be switched immediately. Proration is handled automatically.</p>
						{:else}
							<Button
								onclick={() => handleCheckout(tier.slug)}
								disabled={actionLoading === `checkout-${tier.slug}`}
								class="w-full gap-2"
							>
								{#if actionLoading === `checkout-${tier.slug}`}
									<Loader2 size={14} class="animate-spin" />
								{/if}
								Subscribe to {tier.name}
							</Button>
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<Card.Root class="border-dashed">
			<Card.Header>
				<Card.Title class="text-sm">Need to cancel or get an invoice?</Card.Title>
				<Card.Description>All subscription management, invoices, and payment methods are handled securely in the Polar customer portal.</Card.Description>
			</Card.Header>
			<Card.Content>
				<Button variant="outline" onclick={handlePortal} disabled={actionLoading === 'portal'} class="gap-2">
					{#if actionLoading === 'portal'}
						<Loader2 size={14} class="animate-spin" />
					{:else}
						<ExternalLink size={14} />
					{/if}
					Open customer portal
				</Button>
			</Card.Content>
		</Card.Root>
	{/if}
</div>
