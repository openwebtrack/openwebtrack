<script lang="ts">
	import { onMount } from 'svelte';
	import { CreditCard, ExternalLink, Loader2, AlertCircle, Check, RefreshCw, X } from 'lucide-svelte';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import authClient from '$lib/auth-client';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { fade, fly } from 'svelte/transition';

	type Tier = {
		slug: string;
		priceId: string;
		// legacy Polar field, kept for backwards-compat display
		productId?: string;
		name: string;
		price: string;
		featured?: boolean;
		maxWebsites: number;
		maxEventsPerMonth: number;
		maxMembersPerWebsite: number;
		features: string[];
		trialPeriodDays?: number | null;
	};
	let { tiers = [] }: { tiers: Tier[] } = $props();

	type Subscription = {
		id: string;
		plan: string;
		status: string;
		stripeSubscriptionId?: string | null;
		periodEnd?: string | null;
		trialEnd?: string | null;
		cancelAtPeriodEnd?: boolean | null;
		canceledAt?: string | null;
		endedAt?: string | null;
	};

	let loading = $state(true);
	let error = $state('');
	let subscriptions = $state<Subscription[]>([]);
	let entitlement = $state<{
		dashboardLocked: boolean;
		graceDaysRemaining: number | null;
		expiredAt: string | null;
		trialing?: boolean | null;
	} | null>(null);
	let actionLoading = $state<string | null>(null);
	let actionError = $state('');
	let actionSuccess = $state('');
	let showCheckoutToast = $state(false);
	let toastTimeout: ReturnType<typeof setTimeout> | null = null;

	const activeSub = $derived(subscriptions.find((s) => s.status === 'active' || s.status === 'trialing') ?? null);
	const isTrialing = $derived(activeSub?.status === 'trialing');

	// better-auth stripe stores the plan as the lower-cased tier slug
	const isCurrentTier = (tier: Tier) => {
		if (!activeSub) return false;
		return activeSub.plan?.toLowerCase() === tier.slug.toLowerCase();
	};

	async function fetchState(showLoading = true) {
		if (showLoading) loading = true;
		error = '';
		try {
			const anyClient = authClient as unknown as {
				subscription?: {
					list?: (opts?: unknown) => Promise<{ data: Subscription[] | null; error?: { message?: string } | null }>;
				};
			};
			let list: Subscription[] | null = null;
			if (anyClient.subscription?.list) {
				const res = await anyClient.subscription.list();
				if (res.error) throw new Error(res.error.message ?? 'Failed to load subscriptions');
				list = res.data ?? [];
			} else {
				const res = await fetch('/api/auth/subscription/list');
				if (!res.ok) throw new Error(await res.text());
				const json = await res.json();
				list = Array.isArray(json) ? json : (json?.data ?? []);
			}
			subscriptions = list ?? [];
			// Fetch entitlement for grace/locked banner
			try {
				const r = await fetch('/api/billing/entitlement');
				if (r.ok) {
					const j = await r.json();
					entitlement = j.entitlement
						? {
								dashboardLocked: j.entitlement.dashboardLocked ?? false,
								graceDaysRemaining: j.entitlement.graceDaysRemaining,
								expiredAt: j.entitlement.expiredAt,
								trialing: j.entitlement.trialing ?? false
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

	onMount(() => {
		// Stripe redirects back here after checkout — show a toast instead of a success page
		if (page.url.searchParams.get('checkout') === 'success') {
			showCheckoutToast = true;
			if (toastTimeout) clearTimeout(toastTimeout);
			toastTimeout = setTimeout(() => (showCheckoutToast = false), 6000);
			// Strip the param once the router is ready (replaceState throws if called too early)
			let attempts = 0;
			const stripParam = () => {
				try {
					const url = new URL(page.url);
					url.searchParams.delete('checkout');
					replaceState(url, {});
				} catch {
					if (attempts++ < 20) setTimeout(stripParam, 50);
					else window.history.replaceState({}, '', new URL(page.url).pathname + '?tab=billing');
				}
			};
			setTimeout(stripParam, 0);
		}
		fetchState();
	});

	async function handleCheckout(slug: string) {
		actionLoading = `checkout-${slug}`;
		actionError = '';
		actionSuccess = '';
		try {
			const anyClient = authClient as unknown as {
				subscription?: {
					upgrade?: (p: Record<string, unknown>) => Promise<{
						data?: { url?: string; redirect?: boolean };
						error?: { message?: string } | null;
					}>;
				};
			};
			const successUrl = '/account?tab=billing&checkout=success';
			const cancelUrl = '/account?tab=billing';
			if (anyClient.subscription?.upgrade) {
				const res = await anyClient.subscription.upgrade({
					plan: slug.toLowerCase(),
					successUrl,
					cancelUrl
				});
				if (res.error) throw new Error(res.error.message);
				if (res.data?.url) window.location.href = res.data.url;
				else throw new Error('No checkout URL');
			} else {
				const res = await fetch('/api/auth/subscription/upgrade', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ plan: slug.toLowerCase(), successUrl, cancelUrl })
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
					subscription?: {
						billingPortal?: (p: Record<string, unknown>) => Promise<{
							data?: { url?: string };
							error?: { message?: string } | null;
						}>;
					};
				};
				if (anyClient.subscription?.billingPortal) {
					const res = await anyClient.subscription.billingPortal({
						returnUrl: '/account?tab=billing'
					});
					if (res.error) throw new Error(res.error.message ?? 'Portal failed');
					const url = res.data?.url;
					if (url) return url;
					throw new Error('Portal failed');
				}
				const res = await fetch('/api/auth/subscription/billing-portal', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ returnUrl: '/account?tab=billing' })
				});
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
				if (/CUSTOMER_NOT_FOUND|Customer not found|not found/i.test(msg)) {
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

	function formatDate(d?: string | null) {
		if (!d) return '-';
		try {
			return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
		} catch {
			return d;
		}
	}

	function displayPlanName(plan: string) {
		const tier = tiers.find((t) => t.slug.toLowerCase() === plan.toLowerCase());
		return tier?.name ?? plan;
	}
</script>

<div class="space-y-6" in:fade={{ duration: 150 }}>
	{#if entitlement?.dashboardLocked}
		<Alert.Root variant="destructive">
			<AlertCircle size={16} />
			<Alert.Title>Dashboard locked</Alert.Title>
			<Alert.Description
				>Your subscription expired on {entitlement.expiredAt ? new Date(entitlement.expiredAt).toLocaleDateString() : 'recently'}. Grace period (5 days) has ended. Events are no longer
				collected and dashboard is unavailable. Subscribe to a plan to restore access — your data is preserved.</Alert.Description
			>
		</Alert.Root>
	{:else if isTrialing}
		<Alert.Root class="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300">
			<AlertCircle size={16} />
			<Alert.Title>Trial active</Alert.Title>
			<Alert.Description
				>You are on a free trial{entitlement?.graceDaysRemaining != null
					? ` — ${Math.ceil(entitlement.graceDaysRemaining)} day${Math.ceil(entitlement.graceDaysRemaining) !== 1 ? 's' : ''} left`
					: ''}{entitlement?.expiredAt ? ` (ends ${new Date(entitlement.expiredAt).toLocaleDateString()})` : ''}. Add a payment method in the customer portal below before it ends to keep
				access. Cancel anytime in the customer portal.</Alert.Description
			>
		</Alert.Root>
	{:else if entitlement && entitlement.graceDaysRemaining !== null && !activeSub}
		<Alert.Root class="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300">
			<AlertCircle size={16} />
			<Alert.Title>Subscription expired — grace period</Alert.Title>
			<Alert.Description
				>Events are no longer collected. You have {entitlement.graceDaysRemaining} day{entitlement.graceDaysRemaining !== 1 ? 's' : ''} left before dashboard access is locked. Subscribe again to
				restore full access before {entitlement.expiredAt ? new Date(new Date(entitlement.expiredAt).getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString() : 'then'}.</Alert.Description
			>
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
						You are on <span class="font-medium text-foreground">{displayPlanName(activeSub.plan)}</span>
						{#if isTrialing}
							· Trial ends {formatDate(entitlement?.expiredAt ?? activeSub.trialEnd ?? activeSub.periodEnd)}
							<span class="ml-2 rounded bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-600">Trial</span>
						{:else}
							· Renews {formatDate(activeSub.periodEnd)}
						{/if}
						{#if activeSub.cancelAtPeriodEnd}
							<span class="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">Cancels at period end</span>
						{/if}
					{:else}
						No active subscription. Choose a plan below — every plan starts with a free trial (no card required).
					{/if}
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-wrap gap-2">
				<Button variant="outline" onclick={() => fetchState()} class="gap-2">
					<RefreshCw size={14} /> Refresh
				</Button>
			</Card.Content>
		</Card.Root>

		<!-- Plans — every plan starts with a free trial (card required, once per user) -->
		<div class="grid gap-4 md:grid-cols-2">
			{#each tiers as tier (tier.slug)}
				{@const trialDays = tier.trialPeriodDays ?? 0}
				<Card.Root class={tier.featured ? 'border-primary ring-1 ring-primary/20' : ''}>
					<Card.Header>
						<Card.Title class="flex items-center justify-between">
							<span>{tier.name}</span>
							{#if isCurrentTier(tier)}
								<span class="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-600">{isTrialing ? 'Trial' : 'Current'}</span>
							{:else if tier.featured}
								<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">Popular</span>
							{:else if trialDays > 0 && !activeSub}
								<span class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">{trialDays}-day free trial</span>
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
								<Check size={14} />
								{isTrialing ? 'Trial active' : 'Active'}
							</Button>
						{:else if activeSub}
							<Button onclick={() => handleSwitch(tier.slug)} disabled={actionLoading === `switch-${tier.slug}`} class="w-full gap-2">
								{#if actionLoading === `switch-${tier.slug}`}
									<Loader2 size={14} class="animate-spin" />
								{/if}
								Switch to {tier.name}
							</Button>
							<p class="mt-2 text-xs text-muted-foreground">Your plan will be switched immediately. Proration is handled automatically.</p>
						{:else}
							<Button onclick={() => handleCheckout(tier.slug)} disabled={actionLoading === `checkout-${tier.slug}`} class="w-full gap-2">
								{#if actionLoading === `checkout-${tier.slug}`}
									<Loader2 size={14} class="animate-spin" />
								{/if}
								{trialDays > 0 ? `Start ${trialDays}-day free trial` : `Subscribe to ${tier.name}`}
							</Button>
							{#if trialDays > 0}
								<p class="mt-2 text-xs text-muted-foreground">No card required · add a payment method before the trial ends to keep access.</p>
							{/if}
						{/if}
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		<Card.Root class="border-dashed">
			<Card.Header>
				<Card.Title class="text-sm">Need to cancel or get an invoice?</Card.Title>
				<Card.Description>All subscription management, invoices, and payment methods are handled securely in the Stripe customer portal.</Card.Description>
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
	{#if showCheckoutToast}
		<div class="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2" in:fly={{ y: 16, duration: 250 }} out:fade={{ duration: 150 }}>
			<div class="flex items-center gap-3 rounded-xl border border-green-500/30 bg-card px-4 py-3 shadow-lg">
				<span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-600">
					<Check size={16} />
				</span>
				<div class="min-w-0 flex-1 text-sm">
					<p class="font-medium">Checkout complete</p>
					<p class="text-muted-foreground">Your subscription will be active shortly.</p>
				</div>
				<button aria-label="Dismiss" onclick={() => (showCheckoutToast = false)} class="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground">
					<X size={14} />
				</button>
			</div>
		</div>
	{/if}
</div>
