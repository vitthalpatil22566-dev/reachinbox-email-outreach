import nodemailer, { Transporter } from 'nodemailer';

export interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  body: string;
  senderCredentials?: {
    user: string;
    pass: string;
    host?: string;
    port?: number;
  };
}

export interface MailSendResult {
  messageId: string;
  previewUrl: string | null;
}

export class MailerService {
  private static cachedTestAccount: nodemailer.TestAccount | null = null;
  private static cachedTransporter: Transporter | null = null;

  /**
   * Returns a configured Nodemailer Transporter.
   * If senderCredentials are provided, creates a dedicated transporter for that sender.
   * Otherwise, provisions or reuses an Ethereal test account.
   */
  public static async getTransporter(credentials?: {
    user: string;
    pass: string;
    host?: string;
    port?: number;
  }): Promise<{ transporter: Transporter; fromEmail: string }> {
    if (credentials?.user && credentials?.pass) {
      const transporter = nodemailer.createTransport({
        host: credentials.host || 'smtp.ethereal.email',
        port: credentials.port || 587,
        secure: false,
        auth: {
          user: credentials.user,
          pass: credentials.pass,
        },
      });

      return { transporter, fromEmail: credentials.user };
    }

    // Reuse or create dynamic Ethereal test account
    if (!this.cachedTestAccount || !this.cachedTransporter) {
      console.log('📬 Provisioning dynamic Ethereal Email test account...');
      this.cachedTestAccount = await nodemailer.createTestAccount();
      console.log(`✅ Provisioned Ethereal account: ${this.cachedTestAccount.user}`);

      this.cachedTransporter = nodemailer.createTransport({
        host: this.cachedTestAccount.smtp.host,
        port: this.cachedTestAccount.smtp.port,
        secure: this.cachedTestAccount.smtp.secure,
        auth: {
          user: this.cachedTestAccount.user,
          pass: this.cachedTestAccount.pass,
        },
      });
    }

    return {
      transporter: this.cachedTransporter,
      fromEmail: this.cachedTestAccount.user,
    };
  }

  /**
   * Dispatches an email via Nodemailer Ethereal SMTP.
   * Generates and returns the web preview URL without leaking secrets.
   */
  public static async sendEmail(options: SendMailOptions): Promise<MailSendResult> {
    const { transporter, fromEmail } = await this.getTransporter(options.senderCredentials);

    const fromAddress = options.from || fromEmail;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      text: options.body,
      html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${options.body.replace(
        /\n/g,
        '<br/>'
      )}</div>`,
    });

    // Obtain the web preview URL provided by Ethereal
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`✉️ Email dispatched via SMTP [MsgId: ${info.messageId}]`);
    if (previewUrl) {
      console.log(`🔗 Ethereal Web Preview: ${previewUrl}`);
    }

    return {
      messageId: info.messageId,
      previewUrl: previewUrl ? previewUrl.toString() : null,
    };
  }

  /**
   * Helper to provision a new Ethereal account (useful for onboarding senders).
   */
  public static async createEtherealAccount(): Promise<nodemailer.TestAccount> {
    return await nodemailer.createTestAccount();
  }
}
