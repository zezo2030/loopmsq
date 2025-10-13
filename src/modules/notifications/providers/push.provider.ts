import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Lazy-import to avoid type deps at build time if firebase-admin is absent
let getApps: any, initializeApp: any, getMessaging: any;

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);
  private messaging: any = null;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    if (projectId && clientEmail && privateKey) {
      try {
        // Dynamically require firebase-admin only if configured
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const adminApp = require('firebase-admin/app');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const adminMsg = require('firebase-admin/messaging');
        getApps = adminApp.getApps;
        initializeApp = adminApp.initializeApp;
        getMessaging = adminMsg.getMessaging;
        if (!getApps().length) {
          initializeApp({ projectId } as any);
        }
        this.messaging = getMessaging();
      } catch (e) {
        this.logger.error(`Failed to init Firebase: ${String(e)}`);
      }
    }
  }

  async sendToTokens(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<void> {
    if (this.messaging) {
      try {
        await this.messaging.sendEachForMulticast({
          tokens,
          notification: { title, body },
          data,
        });
        return;
      } catch (e) {
        this.logger.error(`FCM send failed: ${String(e)}`);
      }
    }
    this.logger.log(`[PUSH] to=${tokens.length} title=${title}`);
  }
}


