import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class PayloadEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configuredKey = config.get<string>('OUTBOX_ENCRYPTION_KEY');
    const keyMaterial = configuredKey ?? config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.key = createHash('sha256').update('my-love/outbox-email/v1').update(keyMaterial).digest();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return [iv, ciphertext, cipher.getAuthTag()]
      .map((part) => part.toString('base64url'))
      .join('.');
  }

  decrypt(value: string): string {
    const parts = value.split('.');
    if (parts.length !== 3) throw new Error('Invalid encrypted outbox payload');
    const [ivValue, ciphertextValue, tagValue] = parts;
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivValue, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
