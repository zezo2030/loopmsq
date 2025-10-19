import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name);
  private transporter: nodemailer.Transporter | null = null;
  private from: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    this.from = this.configService.get<string>('SMTP_FROM');
    
    // Log configuration status
    this.logger.log(`SMTP Configuration: host=${host}, port=${port}, user=${user ? '***' : 'NOT_SET'}, from=${this.from}`);
    
    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
      });
      this.logger.log('SMTP transporter configured successfully');
    } else {
      this.logger.warn('SMTP not configured - missing required environment variables');
      this.logger.warn('Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM');
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (this.transporter && this.from) {
      try {
        this.logger.log(`Attempting to send email to: ${to}`);
        await this.transporter.sendMail({ from: this.from, to, subject, html });
        this.logger.log(`Email sent successfully to: ${to}`);
        return;
      } catch (e) {
        this.logger.error(`SMTP send failed: ${String(e)}`);
        this.logger.error(`Error details: ${JSON.stringify(e)}`);
      }
    } else {
      this.logger.warn('SMTP not configured - email will not be sent');
      this.logger.warn(`[EMAIL FALLBACK] to=${to} subject=${subject}`);
    }
    // Fallback to log in non-configured environments
    this.logger.log(`[EMAIL] to=${to} subject=${subject}`);
  }

  /**
   * Check if SMTP is properly configured
   */
  isConfigured(): boolean {
    return this.transporter !== null && this.from !== undefined;
  }

  /**
   * Get configuration status for debugging
   */
  getConfigStatus(): { configured: boolean; missing: string[] } {
    const missing: string[] = [];
    
    if (!this.configService.get<string>('SMTP_HOST')) missing.push('SMTP_HOST');
    if (!this.configService.get<number>('SMTP_PORT')) missing.push('SMTP_PORT');
    if (!this.configService.get<string>('SMTP_USER')) missing.push('SMTP_USER');
    if (!this.configService.get<string>('SMTP_PASS')) missing.push('SMTP_PASS');
    if (!this.configService.get<string>('SMTP_FROM')) missing.push('SMTP_FROM');
    
    return {
      configured: this.isConfigured(),
      missing
    };
  }
}


