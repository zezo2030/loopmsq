import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { RedisService } from '../../../utils/redis.service';
import { EncryptionService } from '../../../utils/encryption.util';

@Injectable()
export class SmsProvider {
  private readonly logger = new Logger(SmsProvider.name);
  private http: AxiosInstance | null = null;
  private apiUrl: string | undefined;
  private user: string | undefined;
  private secretKey: string | undefined;
  private sender: string | undefined;
  private lastConfigHash: string | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly encryption: EncryptionService,
  ) {}

  private async loadConfig(): Promise<void> {
    // Read ONLY from environment variables (ignore admin panel/Redis overrides)
    try {
      const apiUrl = this.configService.get<string>('DREAMS_API_URL');
      const user = this.configService.get<string>('DREAMS_USER');
      const secretKey = this.configService.get<string>('DREAMS_SECRET_KEY');
      const sender = this.configService.get<string>('DREAMS_SENDER');

      const hash = [apiUrl || '', user || '', secretKey || '', sender || ''].join('|');
      if (this.lastConfigHash !== hash) {
        this.lastConfigHash = hash;
        if (apiUrl && user && secretKey) {
          this.http = axios.create({
            baseURL: apiUrl,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 15000,
          });
          this.apiUrl = apiUrl;
          this.user = user;
          this.secretKey = secretKey;
          this.sender = sender;
        } else {
          this.http = null;
          this.apiUrl = undefined;
          this.user = undefined;
          this.secretKey = undefined;
          this.sender = undefined;
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to load SMS config from env: ${String(e)}`);
    }
  }

  async send(to: string, body: string): Promise<void> {
    await this.loadConfig();
    if (this.http && this.user && this.secretKey) {
      try {
        // Dreams API expects form data: user, secret_key, to, message, sender
        const form = new URLSearchParams();
        form.set('user', this.user);
        form.set('secret_key', this.secretKey);
        form.set('to', to);
        form.set('message', body);
        if (this.sender) form.set('sender', this.sender);

        const resp = await this.http.post('', form.toString());
        const data: unknown = resp?.data;
        const text = typeof data === 'string' ? data : JSON.stringify(data);

        // Success example contains 'Result :1' or 'Result:1'
        if (/Result\s*:\s*1/i.test(text)) {
          return;
        }

        // If error code present, log it
        this.logger.error(`Dreams send failed response: ${text}`);
        return;
      } catch (e) {
        this.logger.error(`Dreams send failed: ${String(e)}`);
      }
    }
    // Fallback to log in non-configured environments
    this.logger.log(`[SMS] to=${to} body=${body}`);
  }
}


