import { Html, Head, Preview, Body, Container, Section, Text, Hr, Tailwind, Heading, Row, Column, Link } from '@react-email/components';
import { pixelBasedPreset } from '@react-email/components';

interface WeeklySummaryEmailProps {
	topReferrers: { referrer: string; visits: number }[];
	topCountries: { country: string; visits: number }[];
	topPages: { pathname: string; views: number }[];
	totalPageviews: number;
	totalVisitors: number;
	dashboardUrl: string;
	generatedAt: string;
	periodStart: string;
	periodEnd: string;
	domain: string;
}

const nf = new Intl.NumberFormat('en-US');

const clampTop = (arr: any[], n = 5) => (Array.isArray(arr) ? arr.slice(0, n) : []);

const safeText = (v: string, fallback: string) => {
	const s = (v ?? '').trim();
	return s.length ? s : fallback;
};

const WeeklySummaryEmail = ({ domain, periodStart, periodEnd, totalVisitors, totalPageviews, topPages, topReferrers, topCountries, dashboardUrl, generatedAt }: WeeklySummaryEmailProps) => {
	const previewText = `${nf.format(totalVisitors)} visitors • ${domain} • Weekly summary`;

	const pages = clampTop(topPages, 5);
	const refs = clampTop(topReferrers, 5);
	const countries = clampTop(topCountries, 5);
	const when = generatedAt ?? new Date().toLocaleString();
	const pagesPerVisitor = totalVisitors > 0 ? (totalPageviews / totalVisitors).toFixed(2) : '0.00';

	return (
		<Html lang="en">
			<Head />
			<Preview>{previewText}</Preview>

			<Tailwind config={{ presets: [pixelBasedPreset], theme: { extend: { colors: { ink: '#030712', sub: '#4B5563', line: '#D1D5DB', brand: '#030712' } } } }}>
				<Body className="m-0 bg-white p-0 font-sans">
					<Container className="mx-auto my-8 w-full max-w-[620px] px-4">
						{/*Header */}
						<Section className="border-line border-b pb-6">
							<Text className="text-sub m-0 text-[11px] font-bold tracking-widest uppercase">OpenWebTrack · Weekly Summary</Text>
							<Heading className="text-ink mt-3 mb-1 text-[26px] font-bold">{domain}</Heading>
							<Text className="text-sub m-0 text-[13px] font-medium">
								{periodStart} → {periodEnd}
							</Text>
							<Text className="text-sub mt-1 mb-0 text-[12px] font-medium">Generated: {when}</Text>

							<Section className="mt-5">
								<Link href={dashboardUrl} className="bg-ink inline-block rounded-md px-5 py-3 text-[13px] font-semibold text-white no-underline">
									View dashboard →
								</Link>
							</Section>
						</Section>

						{/* KPI cards */}
						<Section className="mt-8">
							<Text className="text-sub m-0 mb-4 text-[12px] font-bold tracking-widest uppercase">Overview</Text>
							<Row>
								<Column className="pr-3">
									<Section className="border-line rounded-lg border px-5 py-5">
										<Text className="text-sub m-0 text-[11px] font-bold tracking-wide uppercase">Visitors</Text>
										<Text className="text-ink mt-2 mb-0 text-[32px] font-bold tracking-tight">{nf.format(totalVisitors)}</Text>
									</Section>
								</Column>
								<Column className="pl-3">
									<Section className="border-line rounded-lg border px-5 py-5">
										<Text className="text-sub m-0 text-[11px] font-bold tracking-wide uppercase">Pageviews</Text>
										<Text className="text-ink mt-2 mb-0 text-[32px] font-bold tracking-tight">{nf.format(totalPageviews)}</Text>
									</Section>
								</Column>
							</Row>
							<Section className="border-line mt-4 rounded-lg border px-5 py-4">
								<Text className="text-sub m-0 text-[11px] font-bold tracking-wide uppercase">Pages / visitor</Text>
								<Text className="text-ink mt-2 mb-0 text-[22px] font-bold tracking-tight">{pagesPerVisitor}</Text>
							</Section>
						</Section>

						{/* Top Pages */}
						<Section className="mt-10">
							<Text className="text-sub m-0 text-[12px] font-bold tracking-widest uppercase">Top Pages</Text>
							<Hr className="border-line mt-3 mb-4" />

							{pages.length === 0 ? (
								<Text className="text-sub m-0 text-[14px]">No data.</Text>
							) : (
								pages.map((p, idx) => (
									<Row key={`${p.pathname}-${idx}`} className="mb-3">
										<Column>
											<Text className="text-ink m-0 text-[14px] font-medium">
												<span style={{ color: '#6B7280', marginRight: 8, fontWeight: 500 }}>{idx + 1}.</span>
												{safeText(p.pathname, '/')}
											</Text>
										</Column>
										<Column className="w-[90px]">
											<Text className="text-ink m-0 text-right text-[14px] font-bold">
												{nf.format(p.views)}
												<span style={{ color: '#6B7280', fontWeight: 500, marginLeft: 6 }}>views</span>
											</Text>
										</Column>
									</Row>
								))
							)}
						</Section>

						{/* Top Referrers */}
						<Section className="mt-10">
							<Text className="text-sub m-0 text-[12px] font-bold tracking-widest uppercase">Top Referrers</Text>
							<Hr className="border-line mt-3 mb-4" />

							{refs.length === 0 ? (
								<Text className="text-sub m-0 text-[14px]">No data.</Text>
							) : (
								refs.map((r, idx) => (
									<Row key={`${r.referrer}-${idx}`} className="mb-3">
										<Column>
											<Text className="text-ink m-0 text-[14px] font-medium">
												<span style={{ color: '#6B7280', marginRight: 8, fontWeight: 500 }}>{idx + 1}.</span>
												{safeText(r.referrer, '(direct)')}
											</Text>
										</Column>
										<Column className="w-[90px]">
											<Text className="text-ink m-0 text-right text-[14px] font-bold">
												{nf.format(r.visits)}
												<span style={{ color: '#6B7280', fontWeight: 500, marginLeft: 6 }}>visits</span>
											</Text>
										</Column>
									</Row>
								))
							)}
						</Section>

						{/* Top Countries */}
						<Section className="mt-10">
							<Text className="text-sub m-0 text-[12px] font-bold tracking-widest uppercase">Top Countries</Text>
							<Hr className="border-line mt-3 mb-4" />

							{countries.length === 0 ? (
								<Text className="text-sub m-0 text-[14px]">No data.</Text>
							) : (
								countries.map((c, idx) => (
									<Row key={`${c.country}-${idx}`} className="mb-3">
										<Column>
											<Text className="text-ink m-0 text-[14px] font-medium">
												<span style={{ color: '#6B7280', marginRight: 8, fontWeight: 500 }}>{idx + 1}.</span>
												{safeText(c.country, 'Unknown')}
											</Text>
										</Column>
										<Column className="w-[90px]">
											<Text className="text-ink m-0 text-right text-[14px] font-bold">
												{nf.format(c.visits)}
												<span style={{ color: '#6B7280', fontWeight: 500, marginLeft: 6 }}>visits</span>
											</Text>
										</Column>
									</Row>
								))
							)}
						</Section>

						{/* Footer */}
						<Hr className="border-line mt-12 mb-6" />
						<Section>
							<Text className="text-sub m-0 text-[12px] font-medium">
								You're receiving this because weekly analytics reports are enabled for <span style={{ color: '#030712', fontWeight: 700 }}>{domain}</span>.
							</Text>
							<Text className="text-sub mt-2 mb-0 text-[12px] font-medium">© {new Date().getFullYear()} OpenWebTrack</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export default WeeklySummaryEmail;
