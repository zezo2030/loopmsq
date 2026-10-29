import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Lazy-import to avoid type deps at build time if firebase-admin is absent
let getApps: any, initializeApp: any, getMessaging: any, cert: any;

export type PushSendResult = {
  successCount: number;
  failureCount: number;
  /** Tokens FCM rejected permanently — safe to delete. */
  invalidTokens: string[];
};

@Injectable()
export class PushProvider {
  // Hard limit enforced by firebase-admin's sendEachForMulticast.
  private static readonly MAX_TOKENS_PER_BATCH = 500;
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

  /**
   * Send to any number of tokens. FCM rejects a multicast of more than 500
   * tokens outright, so a broadcast to the whole device table used to fail
   * completely ("tokens list must not contain more than 500 items") while the
   * dashboard still reported success. Tokens are chunked here and the ones FCM
   * reports as dead are returned so the caller can delete them.
   */
  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<PushSendResult> {
    const empty: PushSendResult = {
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };

    if (!this.messaging) {
      this.logger.warn(
        `[PUSH] Firebase not initialized - skipping push notification to ${tokens.length} devices`,
      );
      return empty;
    }

    if (!tokens || tokens.length === 0) {
      this.logger.warn('[PUSH] No device tokens provided');
      return empty;
    }

    const unique = Array.from(new Set(tokens.filter(Boolean)));
    const result: PushSendResult = {
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    };

    for (let i = 0; i < unique.length; i += PushProvider.MAX_TOKENS_PER_BATCH) {
      const batch = unique.slice(i, i + PushProvider.MAX_TOKENS_PER_BATCH);
      try {
        const response = await this.messaging.sendEachForMulticast({
          tokens: batch,
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

        result.successCount += response.successCount;
        result.failureCount += response.failureCount;

        if (response.failureCount > 0) {
          response.responses.forEach((resp: any, idx: number) => {
            if (resp.success) return;
            const code = String(resp.error?.code || '');
            const messageText = String(resp.error?.message || 'Unknown error');
            this.logger.warn(
              `[PUSH] Failed to send to token ${i + idx}: ${messageText}`,
            );
            if (this.isDeadToken(code, messageText)) {
              result.invalidTokens.push(batch[idx]);
            }
          });
        }
      } catch (e) {
        result.failureCount += batch.length;
        this.logger.error(`FCM send failed: ${String(e)}`);
        if (e instanceof Error) {
          this.logger.error(`Error details: ${e.message}`);
          this.logger.error(`Stack: ${e.stack}`);
        }
      }
    }

    this.logger.log(
      `[PUSH] Successfully sent to ${result.successCount}/${unique.length} devices`,
    );
    if (result.invalidTokens.length) {
      this.logger.warn(
        `[PUSH] ${result.invalidTokens.length} dead tokens will be removed`,
      );
    }

    return result;
  }

  /** FCM says the app was uninstalled or the token is malformed. */
  private isDeadToken(code: string, message: string): boolean {
    const haystack = `${code} ${message}`.toLowerCase();
    return (
      haystack.includes('registration-token-not-registered') ||
      haystack.includes('invalid-registration-token') ||
      haystack.includes('invalid-argument') ||
      haystack.includes('notregistered')
    );
  }
}
