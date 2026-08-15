import { Injectable, Logger } from '@nestjs/common';
import type { EmailMessage, EmailProvider } from './email.provider';

@Injectable()
export class LoggingEmailProvider implements EmailProvider {
  private readonly logger = new Logger(LoggingEmailProvider.name);

  send(message: EmailMessage): Promise<void> {
    // Development adapter deliberately never logs recipient, subject or body:
    // those values may contain private data and one-time tokens.
    void message;
    this.logger.log({ event: 'email_delivery_simulated' });
    return Promise.resolve();
  }
}
