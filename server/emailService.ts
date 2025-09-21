import { MailService } from '@sendgrid/mail';

// Make email service optional for sprinkler controller
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
let mailService: MailService | null = null;

if (SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(SENDGRID_API_KEY);
  console.log('SendGrid email service initialized');
} else {
  console.log('SendGrid email service disabled (no API key provided)');
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(
  apiKey: string,
  params: EmailParams
): Promise<boolean> {
  if (!mailService) {
    console.warn('Email service not available - SendGrid API key not configured');
    return false;
  }

  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function isEmailServiceAvailable(): boolean {
  return mailService !== null;
}