import * as crypto from 'crypto-js';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;

  constructor(private configService: ConfigService) {
    this.encryptionKey =
      this.configService.get<string>('ENCRYPTION_KEY') ||
      'default-32-character-key-for-dev';
  }

  encrypt(text: string): string {
    return crypto.AES.encrypt(text, this.encryptionKey).toString();
  }

  decrypt(encryptedText: string): string {
    const bytes = crypto.AES.decrypt(encryptedText, this.encryptionKey);
    return bytes.toString(crypto.enc.Utf8);
  }

  hashPassword(password: string): string {
    return crypto.SHA256(password + this.encryptionKey).toString();
  }

  comparePassword(password: string, hashedPassword: string): boolean {
    return this.hashPassword(password) === hashedPassword;
  }
}
