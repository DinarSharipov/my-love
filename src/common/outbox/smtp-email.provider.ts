import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { EmailMessage, EmailProvider } from './email.provider';

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly replyTo?: string;

  constructor(config: ConfigService) {
    const username = config.get<string>('SMTP_USERNAME');
    const password = config.get<string>('SMTP_PASSWORD');
    this.transporter = nodemailer.createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: config.getOrThrow<boolean>('SMTP_SECURE'),
      ...(username && password ? { auth: { user: username, pass: password } } : {}),
    });
    this.from = config.getOrThrow<string>('SMTP_FROM_EMAIL');
    this.replyTo = config.get<string>('SMTP_REPLY_TO');
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(this.replyTo ? { replyTo: this.replyTo } : {}),
    });
  }
}
