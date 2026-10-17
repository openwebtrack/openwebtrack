import { UserPlus, ShoppingCart, Mail, Rocket, Newspaper, CalendarCheck, Send } from 'lucide-svelte';
import type { FunnelStepDef } from '$lib/server/db/schema';

export type FunnelTemplate = {
	id: string;
	name: string;
	description: string;
	icon: typeof Mail;
	steps: FunnelStepDef[];
};

/** Common starting points for the create-funnel dialog. Paths and event names are placeholders the user edits to match their site. */
export const funnelTemplates: FunnelTemplate[] = [
	{
		id: 'signup',
		name: 'Signup',
		description: 'Homepage visitors who check pricing and create an account.',
		icon: UserPlus,
		steps: [
			{ name: 'Landing page', type: 'page_visit', value: '/' },
			{ name: 'Pricing', type: 'page_visit', value: '/pricing' },
			{ name: 'Signup page', type: 'page_visit', value: '/signup' },
			{ name: 'Signed up', type: 'goal', value: 'signup' }
		]
	},
	{
		id: 'ecommerce',
		name: 'E-commerce checkout',
		description: 'From product page to cart, checkout and a completed order.',
		icon: ShoppingCart,
		steps: [
			{ name: 'Product page', type: 'page_visit', value: '/products/%' },
			{ name: 'Added to cart', type: 'goal', value: 'add_to_cart' },
			{ name: 'Checkout', type: 'page_visit', value: '/checkout' },
			{ name: 'Purchase', type: 'goal', value: 'purchase' }
		]
	},
	{
		id: 'lead',
		name: 'Lead / contact form',
		description: 'Visitors who reach your contact page and send the form.',
		icon: Mail,
		steps: [
			{ name: 'Landing page', type: 'page_visit', value: '/' },
			{ name: 'Contact page', type: 'page_visit', value: '/contact' },
			{ name: 'Form submitted', type: 'goal', value: 'form_submit' }
		]
	},
	{
		id: 'demo',
		name: 'Demo request',
		description: 'B2B path from features to a booked demo.',
		icon: CalendarCheck,
		steps: [
			{ name: 'Landing page', type: 'page_visit', value: '/' },
			{ name: 'Features', type: 'page_visit', value: '/features' },
			{ name: 'Demo page', type: 'page_visit', value: '/demo' },
			{ name: 'Demo booked', type: 'goal', value: 'demo_request' }
		]
	},
	{
		id: 'onboarding',
		name: 'SaaS onboarding',
		description: 'New accounts that finish onboarding and hit the key action.',
		icon: Rocket,
		steps: [
			{ name: 'Signed up', type: 'goal', value: 'signup' },
			{ name: 'Onboarding', type: 'page_visit', value: '/onboarding%' },
			{ name: 'Onboarding complete', type: 'goal', value: 'onboarding_complete' },
			{ name: 'First key action', type: 'goal', value: 'first_action' }
		]
	},
	{
		id: 'blog',
		name: 'Blog to signup',
		description: 'Readers who move from content to your signup flow.',
		icon: Newspaper,
		steps: [
			{ name: 'Blog post', type: 'page_visit', value: '/blog/%' },
			{ name: 'Signup page', type: 'page_visit', value: '/signup' },
			{ name: 'Signed up', type: 'goal', value: 'signup' }
		]
	},
	{
		id: 'newsletter',
		name: 'Newsletter subscribe',
		description: 'Readers who subscribe to your newsletter.',
		icon: Send,
		steps: [
			{ name: 'Blog post', type: 'page_visit', value: '/blog/%' },
			{ name: 'Subscribed', type: 'goal', value: 'newsletter_subscribe' }
		]
	}
];
