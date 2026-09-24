import { Html, Head, Preview, Body, Container, Section, Text, Tailwind, Heading, Link } from '@react-email/components';
import { pixelBasedPreset } from '@react-email/components';

interface MagicLinkEmailProps {
	url: string;
}

const MagicLinkEmail = ({ url }: MagicLinkEmailProps) => {
	return (
		<Html lang="en">
			<Head />
			<Preview>Sign in to OpenWebTrack</Preview>

			<Tailwind config={{ presets: [pixelBasedPreset], theme: { extend: { colors: { ink: '#030712', sub: '#4B5563', line: '#D1D5DB' } } } }}>
				<Body className="m-0 bg-white p-0 font-sans">
					<Container className="mx-auto my-8 w-full max-w-[520px] px-4">
						<Section className="border-line border-b pb-6">
							<Text className="text-sub m-0 text-[11px] font-bold tracking-widest uppercase">OpenWebTrack</Text>
							<Heading className="text-ink mt-3 mb-1 text-[24px] font-bold">Sign in to OpenWebTrack</Heading>
							<Text className="text-sub m-0 text-[14px]">Click the button below to sign in. This link expires in 5 minutes.</Text>
							<Section className="mt-5">
								<Link href={url} className="bg-ink inline-block rounded-md px-5 py-3 text-[13px] font-semibold text-white no-underline">
									Sign in →
								</Link>
							</Section>
						</Section>

						<Section className="mt-6">
							<Text className="text-sub m-0 text-[12px]">
								If the button doesn't work, copy and paste this link into your browser:
							</Text>
							<Link href={url} className="text-[12px] break-all">
								{url}
							</Link>
							<Text className="text-sub mt-4 mb-0 text-[12px]">If you didn't request this email, you can safely ignore it.</Text>
							<Text className="text-sub mt-2 mb-0 text-[12px]">© {new Date().getFullYear()} OpenWebTrack</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default MagicLinkEmail;
