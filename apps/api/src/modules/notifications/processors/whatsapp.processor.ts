import { Inject, forwardRef } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { WhatsAppProvider } from '../providers/whatsapp.provider';
import { GiftOrdersService } from '../../gift-orders/gift-orders.service';

type WhatsAppSendJob =
  | { to: string; otp: string; lang: 'ar' | 'en' }
  | {
      to: string;
      type: 'gift_invite';
      giftOrderId: string;
      data: {
        senderName?: string;
        productTitle: string;
        branchName: string;
        claimUrl?: string;
        deepLinkUrl?: string;
      };
      lang: 'ar' | 'en';
    };

@Processor('notifications_whatsapp')
export class WhatsAppProcessor {
  constructor(
    private readonly whatsappProvider: WhatsAppProvider,
    @Inject(forwardRef(() => GiftOrdersService))
    private readonly giftOrdersService: GiftOrdersService,
  ) {}

  @Process('send')
  async handleSend(job: Job<WhatsAppSendJob>): Promise<void> {
    if ('otp' in job.data) {
      const { to, otp, lang } = job.data;
      await this.whatsappProvider.sendOTP(to, otp, lang);
      return;
    }

    const { to, giftOrderId, data, lang } = job.data;
    const result = await this.whatsappProvider.sendGiftInvite(to, {
      senderName: data.senderName,
      productTitle: data.productTitle,
      branchName: data.branchName,
      claimUrl: data.claimUrl || data.deepLinkUrl || '',
    }, lang);

    if (!giftOrderId) {
      return;
    }

    if (result.success) {
      await this.giftOrdersService.markGiftInviteSent(giftOrderId, {
        whatsappMessageId: result.messageId ?? null,
      });
      return;
    }

    await this.giftOrdersService.markGiftInviteFailed(
      giftOrderId,
      result.error ?? 'WHATSAPP_SEND_FAILED',
    );
  }
}
