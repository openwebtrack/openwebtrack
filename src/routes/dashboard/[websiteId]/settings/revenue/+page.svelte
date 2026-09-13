<script lang="ts">
	import { Loader2, ExternalLink, FlaskConical, Banknote } from 'lucide-svelte';
	import { CURRENCIES } from '$lib/utils/constants';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import type { PageData } from './$types';
	import axios from 'axios';

	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Alert from '$lib/components/ui/alert/index.js';
	import { Badge } from '@/components/ui/badge';

	let { data }: { data: PageData } = $props();
	let website = $derived(data.website);

	interface StripeStatus {
		connected: boolean;
		status: string | null;
		secretKeyLast4: string | null;
		hasWebhookSecret: boolean;
		providerWebhookId: string | null;
		stripeAccountId: string | null;
		lastVerifiedAt: string | null;
		lastSyncedAt: string | null;
		lastWebhookAt: string | null;
		lastError: string | null;
		webhookUrl: string;
	}

	const STRIPE_PERMISSIONS = [
		{ resource: 'Charges and Refunds', access: 'Read' },
		{ resource: 'Payment Disputes', access: 'Read' },
		{ resource: 'Customers', access: 'Read' },
		{ resource: 'Checkout Sessions', access: 'Read' },
		{ resource: 'Payment Intents', access: 'Read' },
		{ resource: 'Invoices', access: 'Read' },
		{ resource: 'Subscriptions', access: 'Read' },
		{ resource: 'Products', access: 'Read' },
		{ resource: 'Prices', access: 'Read' },
		{ resource: 'Balance Transaction Sources', access: 'Read' },
		{ resource: 'Events', access: 'Read' },
		{ resource: 'Webhook Endpoints, Event Destinations', access: 'Write' }
	];

	let status = $state<StripeStatus | null>(null);
	let isLoading = $state(true);
	let loadError = $state('');

	const WEBHOOK_EVENTS = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'payment_intent.succeeded', 'charge.succeeded', 'invoice.paid', 'invoice.payment_succeeded'];

	let webhookWarning = $state('');
	let webhookSecret = $state('');
	let isSavingSecret = $state(false);
	let secretError = $state('');
	let secretSaved = $state(false);

	let wizardOpen = $state(false);
	let restrictedKey = $state('');
	let isConnecting = $state(false);
	let connectError = $state('');

	let isDisconnecting = $state(false);
	let activeTab = $state<'sveltekit' | 'nextjs' | 'nuxt' | 'express' | 'laravel'>('sveltekit');

	let currency = $state(website.currency);
	let persistedCurrency = $state(website.currency);
	let loadedWebsiteId = $state<string | null>(null);
	let isSavingCurrency = $state(false);
	let currencyError = $state('');
	let currencySaved = $state(false);

	$effect(() => {
		if (website?.id) {
			loadStatus();
			// Sync the picker only when navigating between websites —
			// never after a save, or the stale layout data would reset it.
			if (loadedWebsiteId !== website.id) {
				loadedWebsiteId = website.id;
				currency = website.currency;
				persistedCurrency = website.currency;
			}
		}
	});

	// Auto-persist the currency on change (skips initial value and in-flight saves).
	$effect(() => {
		const code = currency;
		if (!website?.id || code === persistedCurrency || isSavingCurrency) return;
		void saveCurrency(code);
	});

	const loadStatus = async () => {
		isLoading = true;
		loadError = '';
		try {
			const res = await axios.get(`/api/websites/${website.id}/revenue/stripe`);
			status = res.data;
		} catch (e: any) {
			loadError = e.response?.data?.message || e.message || 'Failed to load Stripe status';
		} finally {
			isLoading = false;
		}
	};

	const openWizard = () => {
		restrictedKey = '';
		connectError = '';
		isConnecting = false;
		wizardOpen = true;
	};

	const connectStripe = async () => {
		if (!restrictedKey.trim()) {
			connectError = 'Paste your restricted key first (rk_live_...)';
			return;
		}
		isConnecting = true;
		connectError = '';
		webhookWarning = '';
		try {
			const res = await axios.post(`/api/websites/${website.id}/revenue/stripe`, { secretKey: restrictedKey.trim() });
			if (res.data?.webhook?.status === 'failed' && res.data.webhook.error) {
				webhookWarning = res.data.webhook.error;
			}
			wizardOpen = false;
			restrictedKey = '';
			await loadStatus();
		} catch (e: any) {
			connectError = e.response?.data?.error || 'Failed to connect Stripe';
		} finally {
			isConnecting = false;
		}
	};

	const saveCurrency = async (code: string) => {
		const prev = persistedCurrency;
		if (!code || code === prev || isSavingCurrency) return;
		isSavingCurrency = true;
		currencyError = '';
		currencySaved = false;
		try {
			await axios.put(`/api/websites/${website.id}`, {
				domain: website.domain,
				timezone: website.timezone,
				currency: code
			});
			persistedCurrency = code;
			currencySaved = true;
			setTimeout(() => (currencySaved = false), 2500);
		} catch (e: any) {
			currency = prev;
			currencyError = e.response?.data?.error || 'Failed to update currency';
		} finally {
			isSavingCurrency = false;
		}
	};

	const saveWebhookSecret = async () => {
		if (!webhookSecret.trim()) return;
		isSavingSecret = true;
		secretError = '';
		secretSaved = false;
		try {
			await axios.post(`/api/websites/${website.id}/revenue/stripe`, { webhookSecret: webhookSecret.trim() });
			webhookSecret = '';
			webhookWarning = '';
			secretSaved = true;
			await loadStatus();
			setTimeout(() => (secretSaved = false), 3000);
		} catch (e: any) {
			secretError = e.response?.data?.error || 'Failed to save webhook secret';
		} finally {
			isSavingSecret = false;
		}
	};

	const disconnect = async () => {
		if (!confirm('Disconnect Stripe? No further payments will be attributed. Historical revenue stays.')) return;
		isDisconnecting = true;
		try {
			await axios.delete(`/api/websites/${website.id}/revenue/stripe`);
			webhookWarning = '';
			webhookSecret = '';
			await loadStatus();
		} catch (e: any) {
			loadError = e.response?.data?.error || 'Failed to disconnect';
		} finally {
			isDisconnecting = false;
		}
	};

	const sveltekitExample = `import Stripe from 'stripe';
import { STRIPE_SECRET_KEY } from '$env/static/private';

const stripe = new Stripe(STRIPE_SECRET_KEY);

// POST /api/checkout — called from your pricing page
export async function POST({ cookies, request }) {
  const { priceId } = await request.json();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://example.com/cancel',
    // Fallback attribution if metadata is ever stripped:
    client_reference_id: \`\${cookies.get('_owt_uid') ?? ''}:\${cookies.get('_owt_ses') ?? ''}\`,
    metadata: {
      owt_visitor_id: cookies.get('_owt_uid') ?? '',
      owt_session_id: cookies.get('_owt_ses') ?? ''
    }
  });

  return Response.json({ url: session.url });
}`;

	const nextjsExample = `// app/api/create-checkout/route.js
import { cookies } from 'next/headers';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST() {
  const cookieStore = await cookies();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: 'price_...', quantity: 1 }],
    success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://example.com/cancel',
    client_reference_id: \`\${cookieStore.get('_owt_uid')?.value ?? ''}:\${cookieStore.get('_owt_ses')?.value ?? ''}\`,
    metadata: {
      owt_visitor_id: cookieStore.get('_owt_uid')?.value ?? '',
      owt_session_id: cookieStore.get('_owt_ses')?.value ?? ''
    }
  });

  return Response.json({ url: session.url });
}`;

	const nuxtExample = `// server/api/create-checkout.post.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default defineEventHandler(async (event) => {
  const { priceId } = await readBody(event);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://example.com/cancel',
    client_reference_id: \`\${getCookie(event, '_owt_uid') ?? ''}:\${getCookie(event, '_owt_ses') ?? ''}\`,
    metadata: {
      owt_visitor_id: getCookie(event, '_owt_uid') ?? '',
      owt_session_id: getCookie(event, '_owt_ses') ?? ''
    }
  });

  return { url: session.url };
});`;

	const expressExample = `// server.js
import express from 'express';
import cookieParser from 'cookie-parser';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

app.use(express.json());
app.use(cookieParser());

app.post('/api/create-checkout', async (req, res) => {
  const { priceId } = req.body;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://example.com/cancel',
    client_reference_id: \`\${req.cookies._owt_uid ?? ''}:\${req.cookies._owt_ses ?? ''}\`,
    metadata: {
      owt_visitor_id: req.cookies._owt_uid ?? '',
      owt_session_id: req.cookies._owt_ses ?? ''
    }
  });

  res.json({ url: session.url });
});`;

	const laravelExample = `// routes/web.php
use Illuminate\\Http\\Request;
use Illuminate\\Support\\Facades\\Route;
use Stripe\\StripeClient;

Route::post('/api/create-checkout', function (Request $request) {
    $stripe = new StripeClient(config('services.stripe.secret'));

    $session = $stripe->checkout->sessions->create([
        'mode' => 'payment',
        'line_items' => [['price' => $request->input('priceId'), 'quantity' => 1]],
        'success_url' => 'https://example.com/success?session_id={CHECKOUT_SESSION_ID}',
        'cancel_url' => 'https://example.com/cancel',
        'client_reference_id' => $request->cookie('_owt_uid', '') . ':' . $request->cookie('_owt_ses', ''),
        'metadata' => [
            'owt_visitor_id' => $request->cookie('_owt_uid', ''),
            'owt_session_id' => $request->cookie('_owt_ses', ''),
        ],
    ]);

    return response()->json(['url' => $session->url]);
});`;

	let tabContent = $derived.by(() => {
		switch (activeTab) {
			case 'nextjs':
				return { code: nextjsExample, language: 'javascript' };
			case 'nuxt':
				return { code: nuxtExample, language: 'typescript' };
			case 'express':
				return { code: expressExample, language: 'javascript' };
			case 'laravel':
				return { code: laravelExample, language: 'php' };
			default:
				return { code: sveltekitExample, language: 'typescript' };
		}
	});
</script>

<svelte:head>
	<title>Revenue - {website.domain}</title>
</svelte:head>

<Card.Root>
	<Card.Header>
		<Card.Title>Revenue</Card.Title>
	</Card.Header>
	<Card.Content class="space-y-3">
		<div class="flex items-center gap-4 rounded-2xl border p-4">
			<img src="/icons/stripe.jpeg" alt="Stripe" class="h-11 w-11 shrink-0 rounded-[12px] object-cover" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold">Stripe</p>
				<p class="truncate text-sm text-muted-foreground">Payments matched to the visits that produced them.</p>
			</div>
			{#if isLoading}
				<span class="text-xs text-muted-foreground">Loading…</span>
			{:else if status?.connected}
				<div class="flex shrink-0 items-center gap-2">
					<span class="inline-flex items-center gap-1.5 text-xs font-medium text-green-500">
						<span class="h-1.5 w-1.5 rounded-full bg-green-500"></span> Connected
					</span>
					<button
						onclick={disconnect}
						disabled={isDisconnecting}
						class="flex shrink-0 items-center gap-1.5 rounded-full border border-destructive/40 px-4 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
					>
						{#if isDisconnecting}<Loader2 size={14} class="animate-spin" />{:else}Disconnect{/if}
					</button>
				</div>
			{:else}
				<button onclick={openWizard} class="shrink-0 rounded-full bg-[#635BFF] px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#4F46E5]"> Connect </button>
			{/if}
		</div>

		<div class="flex items-center gap-4 rounded-2xl border p-4">
			<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-emerald-500/15">
				<Banknote size={20} class="text-emerald-500" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold">Currency</p>
				<p class="truncate text-sm text-muted-foreground">Revenue is converted to this currency in your dashboard.</p>
			</div>
			<div class="flex shrink-0 items-center gap-2">
				{#if isSavingCurrency}
					<Loader2 size={14} class="animate-spin text-muted-foreground" />
				{:else if currencySaved}
					<span class="text-xs font-medium text-green-500">Saved</span>
				{/if}
				<Select.Root bind:value={currency} type="single">
					<Select.Trigger class="w-28">{currency}</Select.Trigger>
					<Select.Content>
						{#each CURRENCIES as curr}
							<Select.Item value={curr.code} label={`${curr.code} - ${curr.name}`} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		{#if currencyError}
			<p class="mt-2 text-xs text-destructive">{currencyError}</p>
		{/if}
		{#if loadError}
			<Alert.Root variant="destructive" class="mt-3"><Alert.Description>{loadError}</Alert.Description></Alert.Root>
		{/if}
		{#if status?.connected && !status.hasWebhookSecret}
			<div class="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
				<p class="font-medium text-amber-600 dark:text-amber-400">Webhook not connected</p>
				<p class="mt-1 text-muted-foreground">
					{#if webhookWarning}{webhookWarning}{:else}Automatic setup didn't finish, so new payments won't arrive in real time.{/if}
					Add the endpoint manually in Stripe → Developers → Webhooks:
				</p>
				<p class="mt-2 font-mono text-xs break-all">{status.webhookUrl}</p>
				<p class="mt-2 text-xs text-muted-foreground">
					Events: {#each WEBHOOK_EVENTS as ev, i}<code class="rounded bg-muted px-1 py-0.5">{ev}</code>{#if i < WEBHOOK_EVENTS.length - 1},
						{/if}{/each}. Then paste the endpoint's signing secret below:
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-2">
					<Input type="password" bind:value={webhookSecret} placeholder="whsec_..." autocomplete="off" class="max-w-sm flex-1" />
					<Button onclick={saveWebhookSecret} disabled={!webhookSecret.trim() || isSavingSecret} size="sm">
						{#if isSavingSecret}<Loader2 size={14} class="animate-spin" />{/if}
						Save secret
					</Button>
				</div>
				{#if secretError}<p class="mt-2 text-xs text-destructive">{secretError}</p>{/if}
				{#if secretSaved}<p class="mt-2 text-xs text-green-500">Saved — events are now signature-verified.</p>{/if}
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<Card.Root class="mt-6">
	<Card.Header>
		<Card.Title>Attribute checkout to a visit</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="mb-3 flex flex-wrap gap-2">
			<Button variant={activeTab === 'sveltekit' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'sveltekit')}>SvelteKit</Button>
			<Button variant={activeTab === 'nextjs' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'nextjs')}>Next.js</Button>
			<Button variant={activeTab === 'nuxt' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'nuxt')}>Nuxt</Button>
			<Button variant={activeTab === 'express' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'express')}>Express</Button>
			<Button variant={activeTab === 'laravel' ? 'secondary' : 'ghost'} size="sm" onclick={() => (activeTab = 'laravel')}>Laravel</Button>
		</div>
		<CodeBlock code={tabContent.code} language={tabContent.language} />
		<p class="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
			<FlaskConical size={14} class="mt-0.5 shrink-0" />
		</p>
	</Card.Content>
</Card.Root>

<Dialog.Root
	bind:open={wizardOpen}
	onOpenChange={(open) => {
		if (!open && !isConnecting) {
			restrictedKey = '';
			connectError = '';
		}
		if (!open && isConnecting) wizardOpen = true;
	}}
>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
		<Dialog.Header>
			<Dialog.Title>Connect Stripe</Dialog.Title>
			<Dialog.Description>
				Create a <span class="font-medium text-foreground">restricted key</span> in your Stripe dashboard with access to the resources below. We store it encrypted and never show it again.
				<a href="https://dashboard.stripe.com/apikeys/create" target="_blank" rel="noreferrer" class="mt-1 inline-flex items-center gap-1 font-medium text-[#635BFF] hover:underline">
					Open Stripe's create-key screen <ExternalLink size={14} />
				</a>
			</Dialog.Description>
		</Dialog.Header>

		<div class="max-h-48 overflow-y-auto rounded-xl bg-muted/60 p-4 text-sm">
			{#each STRIPE_PERMISSIONS as p}
				<div class="grid grid-cols-[250px_1fr] gap-3 py-1.5">
					<span class="font-medium">{p.resource}</span>
					<Badge variant={p.access === 'Write' ? 'default' : 'secondary'} class="h-fit!">{p.access}</Badge>
				</div>
			{/each}
		</div>

		<ol class="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
			<li>
				Name it <span class="font-medium text-foreground">OpenWebTrack Revenue</span>, set the resources above as shown, then click <span class="font-medium text-foreground">Create key</span>.
			</li>
			<li>Copy the <code class="rounded bg-muted px-1 py-0.5 font-mono">rk_live_...</code> value — Stripe shows it only once — and paste it below.</li>
		</ol>

		<div>
			<Label for="wizard-rk" class="mb-2 block text-sm">Restricted API key</Label>
			<Input
				id="wizard-rk"
				type="password"
				bind:value={restrictedKey}
				placeholder="rk_live_..."
				autocomplete="off"
				disabled={isConnecting}
				onkeydown={(e) => e.key === 'Enter' && connectStripe()}
			/>
			<p class="mt-2 text-xs text-muted-foreground">Connecting checks the key with Stripe, creates the webhook, and starts the backfill.</p>
		</div>

		{#if connectError}
			<Alert.Root variant="destructive"><Alert.Description>{connectError}</Alert.Description></Alert.Root>
		{/if}

		<Dialog.Footer class="gap-2">
			<Button variant="ghost" onclick={() => (wizardOpen = false)} disabled={isConnecting}>Cancel</Button>
			<button
				onclick={connectStripe}
				disabled={isConnecting || !restrictedKey.trim()}
				class="flex items-center gap-2 rounded-full bg-[#635BFF] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4F46E5] disabled:opacity-50"
			>
				{#if isConnecting}<Loader2 size={14} class="animate-spin" />Connecting…{:else}Connect{/if}
			</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
