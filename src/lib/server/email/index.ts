import { MailerooClient, EmailAddress } from 'maileroo-sdk';
import { render } from '@react-email/render';
import { env } from '$env/dynamic/private';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface SendEmailOptions {
	to: string;
	toName?: string;
	subject: string;
	children: any;
	plain: string;
	html?: string;
}

const senderEmail = env.SENDER_EMAIL;
const mailerooApiKey = env.MAILEROO_API_KEY;
const resendApiKey = env.RESEND_API_KEY;
const smtpHost = env.SMTP_HOST;
const smtpPort = env.SMTP_PORT;
const smtpUser = env.SMTP_USER;
const smtpPass = env.SMTP_PASS;

let mailerooClient: MailerooClient | null = null;
let resendClient: Resend | null = null;
let smtpTransporter: nodemailer.Transporter | null = null;

const getMailerooClient = (): MailerooClient => {
	if (!mailerooClient) mailerooClient = new MailerooClient(mailerooApiKey);
	return mailerooClient;
};

const getResendClient = (): Resend => {
	if (!resendClient) resendClient = new Resend(resendApiKey);
	return resendClient;
};

const getSmtpTransporter = (): nodemailer.Transporter => {
	if (!smtpTransporter) {
		smtpTransporter = nodemailer.createTransport({
			host: smtpHost,
			port: parseInt(smtpPort || '587'),
			secure: smtpPort === '465',
			auth: {
				user: smtpUser,
				pass: smtpPass
			}
		});
	}
	return smtpTransporter;
};

const sendWithMaileroo = async ({ to, subject, children, plain }: SendEmailOptions): Promise<string | null> => {
	if (!senderEmail) {
		console.error('[Email] SENDER_EMAIL is not configured');
		return null;
	}

	try {
		const maileroo = getMailerooClient();
		const referenceId = await maileroo.sendBasicEmail({ from: new EmailAddress(senderEmail, 'OpenWebTrack'), html: await render(children), to: [new EmailAddress(to)], subject, plain });
		return referenceId;
	} catch (error) {
		console.error('[Email] Failed to send email via Maileroo:', error);
		return null;
	}
};

const sendWithResend = async ({ to, subject, children, plain }: SendEmailOptions): Promise<string | null> => {
	try {
		const resend = getResendClient();
		const { data, error } = await resend.emails.send({ from: senderEmail || 'onboarding@resend.dev', to: [to], subject, html: await render(children), text: plain });

		if (error) {
			console.error('[Email] Failed to send email via Resend:', error);
			return null;
		}

		return data?.id ?? null;
	} catch (error) {
		console.error('[Email] Failed to send email via Resend:', error);
		return null;
	}
};

const sendWithSmtp = async ({ to, subject, children, plain }: SendEmailOptions): Promise<string | null> => {
	if (!smtpHost || !senderEmail) {
		console.error('[Email] SMTP is not configured');
		return null;
	}

	try {
		const transporter = getSmtpTransporter();
		const info = await transporter.sendMail({ from: senderEmail, to, subject, html: await render(children), text: plain });
		return info.messageId;
	} catch (error) {
		console.error('[Email] Failed to send email via SMTP:', error);
		return null;
	}
};

export const sendEmail = async (options: SendEmailOptions): Promise<string | null> => {
	if (resendApiKey) return sendWithResend(options);
	if (smtpHost && smtpUser && smtpPass) return sendWithSmtp(options);
	if (mailerooApiKey) return sendWithMaileroo(options);
	return null;
};

export const isEmailConfigured = (): boolean => !!(resendApiKey || mailerooApiKey || (smtpHost && smtpUser && smtpPass));
