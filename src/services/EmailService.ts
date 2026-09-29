import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  simulated?: boolean;
}

export class EmailService {
  private static instance: EmailService | null = null;
  private transporter: Transporter | null = null;
  private isConfigured = false;

  private constructor() {
    this.initTransporter();
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  private initTransporter(): void {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false }
      });
      this.isConfigured = true;
      console.log(`[EmailService] SMTP Transporter configured for ${host}:${port}`);
    } else {
      this.isConfigured = false;
      console.log('[EmailService] SMTP credentials not provided in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS).');
    }
  }

  public isReady(): boolean {
    return this.isConfigured;
  }

  public async sendVerificationEmail(
    toEmail: string,
    username: string,
    token: string,
    verificationUrl: string
  ): Promise<EmailSendResult> {
    const from = process.env.SMTP_FROM || '"Craft Command Center" <no-reply@craftcommand.center>';
    const subject = 'Verify Your Email Address';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #38bdf8; margin-top: 0;">Email Verification Request</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>Thank you for registering. Please click the button below or copy the link to verify your email address:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${verificationUrl}" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verify Email Address</a>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">Verification Token: <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #38bdf8;">${token}</code></p>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 12px;">If you did not request this, please ignore this message.</p>
      </div>
    `;

    if (!this.isConfigured || !this.transporter) {
      console.warn(`[EmailService] Email configuration missing. Verification URL for ${toEmail}: ${verificationUrl}`);
      return {
        success: false,
        simulated: true,
        error: 'SMTP server configuration is missing in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS required).'
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('[EmailService] Failed to send verification email:', err);
      return { success: false, error: err?.message || 'SMTP delivery error' };
    }
  }

  public async sendPasswordResetEmail(
    toEmail: string,
    username: string,
    token: string,
    resetUrl: string
  ): Promise<EmailSendResult> {
    const from = process.env.SMTP_FROM || '"Craft Command Center" <no-reply@craftcommand.center>';
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #f43f5e; margin-top: 0;">Password Reset Instructions</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>We received a request to reset your password. Click the button below to specify a new password:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background-color: #e11d48; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p style="font-size: 13px; color: #94a3b8;">This token expires in 1 hour. Reset Token: <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #f43f5e;">${token}</code></p>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 12px;">If you did not request a password reset, no action is needed.</p>
      </div>
    `;

    if (!this.isConfigured || !this.transporter) {
      console.warn(`[EmailService] Email configuration missing. Password Reset URL for ${toEmail}: ${resetUrl}`);
      return {
        success: false,
        simulated: true,
        error: 'SMTP server configuration is missing in environment variables (SMTP_HOST, SMTP_USER, SMTP_PASS required).'
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      console.error('[EmailService] Failed to send password reset email:', err);
      return { success: false, error: err?.message || 'SMTP delivery error' };
    }
  }

  public async sendSecurityAlertEmail(
    toEmail: string,
    username: string,
    action: string,
    ipAddress: string
  ): Promise<EmailSendResult> {
    const from = process.env.SMTP_FROM || '"Craft Command Center" <no-reply@craftcommand.center>';
    const subject = `Security Alert: ${action}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #334155;">
        <h2 style="color: #eab308; margin-top: 0;">Account Security Notification</h2>
        <p>Hello <strong>${username}</strong>,</p>
        <p>A security event occurred on your account:</p>
        <ul>
          <li><strong>Event:</strong> ${action}</li>
          <li><strong>IP Address:</strong> ${ipAddress}</li>
          <li><strong>Time:</strong> ${new Date().toUTCString()}</li>
        </ul>
        <p style="font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 12px;">If this wasn't you, please reset your password immediately.</p>
      </div>
    `;

    if (!this.isConfigured || !this.transporter) {
      return {
        success: false,
        simulated: true,
        error: 'SMTP server configuration is missing.'
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from,
        to: toEmail,
        subject,
        html
      });
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      return { success: false, error: err?.message || 'SMTP delivery error' };
    }
  }
}
