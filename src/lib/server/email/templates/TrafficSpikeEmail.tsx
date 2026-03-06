import { Html, Head, Preview, Body, Container, Section, Text, Hr, Tailwind, Heading, Row, Column, Link } from '@react-email/components';
import { pixelBasedPreset } from '@react-email/components';

interface TrafficSpikeEmailProps {
	windowSeconds: number;
	dashboardUrl: string;
	threshold: number;
	visitors: number;
	domain: string;
	date: string;
}

const nf = new Intl.NumberFormat('en-US');

const TrafficSpikeEmail = ({ domain, visitors, threshold, windowSeconds, date, dashboardUrl }: TrafficSpikeEmailProps) => {
	const previewText = `⚡ ${nf.format(visitors)} visitors in ${windowSeconds}s - ${domain}`;

	return (
		<Html lang="en">
			<Head />
			<Preview>{previewText}</Preview>

			<Tailwind config={{ presets: [pixelBasedPreset], theme: { extend: { colors: { ink: '#030712', sub: '#4B5563', line: '#D1D5DB', brand: '#030712' } } } }}>
				<Body className="m-0 bg-white p-0 font-sans">
					<Container className="mx-auto my-8 w-full max-w-[620px] px-4">
						{/* Header */}
						<Section className="border-line border-b pb-6">
							<Text className="text-sub m-0 text-[11px] font-bold tracking-widest uppercase">OpenWebTrack · Traffic Alert</Text>
							<Heading className="text-ink mt-3 mb-1 text-[26px] font-bold">{domain}</Heading>
							<Text className="text-sub m-0 text-[13px] font-medium">Status: High Traffic Detected ⚡</Text>
							<Text className="text-sub mt-1 mb-0 text-[12px] font-medium">Detected at: {date}</Text>

							<Section className="mt-5">
								<Link href={dashboardUrl} className="bg-ink inline-block rounded-md px-5 py-3 text-[13px] font-semibold text-white no-underline">
									View live traffic →
								</Link>
							</Section>
						</Section>

						{/* Alert Info & Metrics */}
						<Section className="mt-8">
							<Text className="text-ink m-0 mb-8 text-[15px] leading-[24px] font-medium">
								Your website is experiencing a sudden surge in traffic! The number of active visitors has exceeded your configured alert threshold of{' '}
								<span style={{ fontWeight: 700 }}>{nf.format(threshold)}</span>.
							</Text>

							<Text className="text-sub m-0 mb-4 text-[12px] font-bold tracking-widest uppercase">Spike Details</Text>
							<Row>
								<Column className="pr-3">
									<Section className="border-line rounded-lg border px-5 py-5">
										<Text className="text-sub m-0 text-[11px] font-bold tracking-wide uppercase">Active Visitors</Text>
										<Text className="text-ink mt-2 mb-0 text-[32px] font-bold tracking-tight">{nf.format(visitors)}</Text>
									</Section>
								</Column>
								<Column className="pl-3">
									<Section className="border-line rounded-lg border px-5 py-5">
										<Text className="text-sub m-0 text-[11px] font-bold tracking-wide uppercase">Time Window</Text>
										<Text className="text-ink mt-2 mb-0 text-[32px] font-bold tracking-tight">{windowSeconds}s</Text>
									</Section>
								</Column>
							</Row>
						</Section>

						{/* Footer */}
						<Hr className="border-line mt-12 mb-6" />
						<Section>
							<Text className="text-sub m-0 text-[12px] font-medium">
								You're receiving this because traffic spike alerts are enabled for <span style={{ color: '#030712', fontWeight: 700 }}>{domain}</span>.
							</Text>
							<Text className="text-sub mt-2 mb-0 text-[12px] font-medium">© {new Date().getFullYear()} OpenWebTrack</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default TrafficSpikeEmail;
