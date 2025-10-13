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
    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: Number(port) === 465,
        auth: { user, pass },
      });
    }
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    if (this.transporter && this.from) {
      try {
        await this.transporter.sendMail({ from: this.from, to, subject, html });
        return;
      } catch (e) {
        this.logger.error(`SMTP send failed: ${String(e)}`);
      }
    }
    // Fallback to log in non-configured environments
    this.logger.log(`[EMAIL] to=${to} subject=${subject}`);
  }
}


