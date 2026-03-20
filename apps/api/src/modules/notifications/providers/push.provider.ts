import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Lazy-import to avoid type deps at build time if firebase-admin is absent
let getApps: any, initializeApp: any, getMessaging: any, cert: any;

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);
  private messaging: any = null;
  private isInitialized: boolean = false;
  private initializationError: string | null = null;

  constructor(private readonly config: ConfigService) {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );
    this.logger.log('🔥 Firebase Integration Status Check');
    this.logger.log(
      '═══════════════════════════════════════════════════════════',
    );

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    let privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    // Handle private key formatting - replace escaped newlines
    if (privateKey) {
      privateKey = privateKey.replace(/\\n/g, '\n');
      // Remove quotes if present
      privateKey = privateKey.replace(/^["']|["']$/g, '');
    }

    const hasProjectId = !!projectId;
    const hasClientEmail = !!clientEmail;
    const hasPrivateKey = !!privateKey;

    this.logger.log(`📋 Configuration Check:`);
    this.logger.log(
      `   ✓ FIREBASE_PROJECT_ID: ${hasProjectId ? '✅ موجود' : '❌ غير موجود'}`,
    );
    this.logger.log(
      `   ✓ FIREBASE_CLIENT_EMAIL: ${hasClientEmail ? '✅ موجود' : '❌ غير موجود'}`,
    );
    this.logger.log(
      `   ✓ FIREBASE_PRIVATE_KEY: ${hasPrivateKey ? '✅ موجود' : '❌ غير موجود'}`,
    );

    if (projectId && clientEmail && privateKey) {
      try {
        // Dynamically require firebase-admin only if configured

        const adminApp = require('firebase-admin/app');

        const adminMsg = require('firebase-admin/messaging');

        getApps = adminApp.getApps;
        initializeApp = adminApp.initializeApp;
        getMessaging = adminMsg.getMessaging;
        cert = adminApp.cert;

        if (!getApps().length) {
          // Properly initialize Firebase with credentials
          initializeApp({
            credential: cert({
              projectId,
              clientEmail,
              privateKey,
            }),
          });
          this.logger.log(`✅ Firebase initialized successfully`);
          this.logger.log(`   Project ID: ${projectId}`);
          this.logger.log(`   Client Email: ${clientEmail}`);
        } else {
          this.logger.log(`✅ Firebase already initialized`);
        }
        this.messaging = getMessaging();
        this.isInitialized = true;
        this.logger.log(
          '═══════════════════════════════════════════════════════════',
        );
        this.logger.log(
          '✅ Firebase Integration: ACTIVE - Push notifications enabled',
        );
        this.logger.log(
          '═══════════════════════════════════════════════════════════',
        );
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        this.initializationError = errorMsg;
        this.logger.error(
          '═══════════════════════════════════════════════════════════',
        );
        this.logger.error('❌ Firebase Integration: FAILED');
        this.logger.error(
          '═══════════════════════════════════════════════════════════',
        );
        this.logger.error(`   Error: ${errorMsg}`);
        if (e instanceof Error && e.stack) {
          this.logger.error(`   Stack: ${e.stack}`);
        }
        this.logger.error(
          '═══════════════════════════════════════════════════════════',
        );
      }
    } else {
      this.logger.warn(
        '═══════════════════════════════════════════════════════════',
      );
      this.logger.warn('⚠️  Firebase Integration: NOT CONFIGURED');
      this.logger.warn(
        '═══════════════════════════════════════════════════════════',
      );
      this.logger.warn('   Push notifications will be DISABLED');
      this.logger.warn(
        '   To enable, set the following environment variables:',
      );
      this.logger.warn('   - FIREBASE_PROJECT_ID');
      this.logger.warn('   - FIREBASE_CLIENT_EMAIL');
      this.logger.warn('   - FIREBASE_PRIVATE_KEY');
      this.logger.warn(
        '═══════════════════════════════════════════════════════════',
      );
    }
  }

  getStatus(): { initialized: boolean; error?: string; projectId?: string } {
    return {
      initialized: this.isInitialized,
      error: this.initializationError || undefined,
      projectId: this.config.get<string>('FIREBASE_PROJECT_ID') || undefined,
    };
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.messaging) {
      this.logger.warn(
        `[PUSH] Firebase not initialized - skipping push notification to ${tokens.length} devices`,
      );
      return;
    }

    if (!tokens || tokens.length === 0) {
      this.logger.warn('[PUSH] No device tokens provided');
      return;
    }

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data || {},
        android: {
          priority: 'high',
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
      });

      this.logger.log(
        `[PUSH] Successfully sent to ${response.successCount}/${tokens.length} devices`,
      );

      // Handle failed tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp: any, idx: number) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            this.logger.warn(
              `[PUSH] Failed to send to token ${idx}: ${resp.error?.message || 'Unknown error'}`,
            );
          }
        });
        // You might want to remove invalid tokens from database here
        this.logger.warn(
          `[PUSH] ${failedTokens.length} tokens failed - consider removing invalid tokens`,
        );
      }
    } catch (e) {
      this.logger.error(`FCM send failed: ${String(e)}`);
      if (e instanceof Error) {
        this.logger.error(`Error details: ${e.message}`);
        this.logger.error(`Stack: ${e.stack}`);
      }
    }
  }
}
