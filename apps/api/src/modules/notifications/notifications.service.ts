import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { EmailProvider } from './providers/email.provider';

export type NotificationChannel = 'sms' | 'email' | 'push';

export interface EnqueueNotification {
  type:
    | 'OTP'
    | 'BOOKING_CONFIRMED'
    | 'BOOKING_REMINDER'
    | 'BOOKING_END'
    | 'BOOKING_CANCELLED'
    | 'PAYMENT_SUCCESS'
    | 'TICKETS_ISSUED'
    | 'TRIP_STATUS'
    | 'EVENT_STATUS'
    | 'PROMO'
    | 'ADMIN_MESSAGE'
    | 'LOYALTY_EARN'
    | 'LOYALTY_REDEEM'
    | 'RATING_REQUEST';
  to: { phone?: string; email?: string; userId?: string };
  template?: string;
  data: Record<string, unknown>;
  lang?: 'ar' | 'en';
  channels: NotificationChannel[];
  delayMs?: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications_sms') private readonly smsQueue: Queue,
    @InjectQueue('notifications_email') private readonly emailQueue: Queue,
    @InjectQueue('notifications_push') private readonly pushQueue: Queue,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(DeviceToken) private readonly tokenRepo: Repository<DeviceToken>,
    private readonly encryption: EncryptionService,
    private readonly emailProvider: EmailProvider,
  ) {}

  async enqueue(n: EnqueueNotification): Promise<void> {
    const resolved = await this.resolveRecipient(n.to);
    const lang = n.lang || resolved.lang || 'ar';
    const jobs: Promise<any>[] = [];

    if (n.channels.includes('sms') && (n.to.phone || resolved.phone)) {
      const body = this.renderTemplate(n, 'sms', lang);
      jobs.push(
        this.smsQueue.add(
          'send',
          { to: n.to.phone || resolved.phone!, body, meta: { type: n.type, lang } },
          { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, ...(n.delayMs ? { delay: n.delayMs } : {}) },
        ),
      );
    }

    if (n.channels.includes('email') && (n.to.email || resolved.email)) {
      const subject = this.renderSubject(n, lang);
      const html = this.renderTemplate(n, 'email', lang);
      jobs.push(
        this.emailQueue.add(
          'send',
          { to: n.to.email || resolved.email!, subject, html, meta: { type: n.type, lang } },
          { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, ...(n.delayMs ? { delay: n.delayMs } : {}) },
        ),
      );
    }

    if (n.channels.includes('push')) {
      const tokens = await this.getUserTokens(n.to.userId, resolved.phone);
      if (tokens.length) {
        const title = this.renderSubject(n, lang);
        const body = this.renderTemplate(n, 'sms', lang); // concise body for push
        jobs.push(
          this.pushQueue.add(
            'send',
            { tokens, title, body, data: this.buildPushData(n) },
            { attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: true, ...(n.delayMs ? { delay: n.delayMs } : {}) },
          ),
        );
      }
    }

    await Promise.all(jobs);
  }

  private async resolveRecipient(to: { phone?: string; email?: string; userId?: string }): Promise<{ phone?: string; email?: string; lang?: 'ar' | 'en' }> {
    if (to.userId) {
      const user = await this.userRepo.findOne({ where: { id: to.userId } });
      if (user) {
        let phone: string | undefined;
        try {
          phone = user.phone ? this.encryption.decrypt(user.phone) : undefined;
        } catch {
          phone = undefined;
        }
        return { phone, email: user.email || undefined, lang: (user.language as any) || undefined };
      }
    }
    return { phone: to.phone, email: to.email };
  }

  private async getUserTokens(userId?: string, _phone?: string): Promise<string[]> {
    if (!userId) return [];
    const list = await this.tokenRepo.find({ where: { userId } });
    return list.map((t) => t.token);
  }

  private buildPushData(n: EnqueueNotification): Record<string, string> {
    const base = { type: n.type } as Record<string, string>;
    for (const [k, v] of Object.entries(n.data || {})) {
      if (v == null) continue;
      base[k] = String(v);
    }
    return base;
  }

  private renderSubject(n: EnqueueNotification, lang: 'ar' | 'en'): string {
    switch (n.type) {
      case 'OTP':
        return lang === 'ar' ? 'رمز التحقق' : 'Your OTP Code';
      case 'BOOKING_CONFIRMED':
        return lang === 'ar' ? 'تأكيد الحجز' : 'Booking Confirmed';
      case 'BOOKING_REMINDER':
        return lang === 'ar' ? 'تذكير بالحجز' : 'Booking Reminder';
      case 'BOOKING_END':
        return lang === 'ar' ? 'انتهاء الحجز' : 'Booking Ended';
      case 'RATING_REQUEST':
        return lang === 'ar' ? 'تقييم تجربتك' : 'Rate Your Experience';
      case 'BOOKING_CANCELLED':
        return lang === 'ar' ? 'إلغاء الحجز' : 'Booking Cancelled';
      case 'PAYMENT_SUCCESS':
        return lang === 'ar' ? 'تم الدفع بنجاح' : 'Payment Successful';
      case 'TICKETS_ISSUED':
        return lang === 'ar' ? 'إصدار التذاكر' : 'Tickets Issued';
      case 'TRIP_STATUS':
        return lang === 'ar' ? 'حالة طلب الرحلة' : 'Trip Request Status';
      case 'EVENT_STATUS':
        return lang === 'ar' ? 'حالة طلب المناسبة' : 'Event Request Status';
      default:
        return lang === 'ar' ? 'تنبيه' : 'Notification';
    }
  }

  private renderTemplate(n: EnqueueNotification, channel: NotificationChannel | 'email', lang: 'ar' | 'en'): string {
    if (n.template) return n.template;
    const d = n.data as any;
    switch (n.type) {
      case 'OTP':
        return lang === 'ar' ? `رمز التحقق الخاص بك: ${d.otp}` : `Your OTP code is: ${d.otp}`;
      case 'BOOKING_CONFIRMED':
        return lang === 'ar'
          ? `تم تأكيد حجزك رقم ${d.bookingId}. شكراً لاختيارك لنا.`
          : `Your booking ${d.bookingId} is confirmed. Thank you.`;
      case 'BOOKING_REMINDER':
        return lang === 'ar'
          ? `تذكير: حجزك رقم ${d.bookingId} بتاريخ ${d.startTime} في ${d.branchName || ''}`
          : `Reminder: Your booking ${d.bookingId} at ${d.startTime} ${d.branchName ? 'in ' + d.branchName : ''}`;
      case 'BOOKING_END':
        return lang === 'ar'
          ? `انتهى وقت حجزك رقم ${d.bookingId}. نأمل أن تكون تجربتك ممتعة.`
          : `Your booking ${d.bookingId} has ended. We hope you enjoyed it.`;
      case 'BOOKING_CANCELLED':
        return lang === 'ar'
          ? `تم إلغاء حجزك رقم ${d.bookingId}${d.reason ? '، السبب: ' + d.reason : ''}`
          : `Your booking ${d.bookingId} was cancelled${d.reason ? ', reason: ' + d.reason : ''}.`;
      case 'PAYMENT_SUCCESS':
        return lang === 'ar'
          ? `تم استلام دفعتك بنجاح بمبلغ ${d.amount} ${d.currency}.`
          : `We received your payment of ${d.amount} ${d.currency}.`;
      case 'TICKETS_ISSUED':
        return lang === 'ar'
          ? (d.welcomeMessage || `تم إصدار التذاكر لحجزك ${d.bookingId}. نتمنى لك وقتاً ممتعاً!`)
          : (d.welcomeMessage || `Tickets issued for booking ${d.bookingId}. Enjoy!`);
      case 'TRIP_STATUS':
        return lang === 'ar'
          ? `تم تحديث حالة طلب الرحلة إلى: ${d.status}`
          : `Trip request status updated to: ${d.status}`;
      case 'EVENT_STATUS':
        return lang === 'ar'
          ? `تم تحديث حالة طلب المناسبة إلى: ${d.status}`
          : `Event request status updated to: ${d.status}`;
      case 'PROMO':
        return String(d.message || (lang === 'ar' ? 'عرض ترويجي' : 'Promotion'));
      case 'ADMIN_MESSAGE':
        return String(d.message || (lang === 'ar' ? 'رسالة من الإدارة' : 'Admin Message'));
      case 'LOYALTY_EARN':
        return lang === 'ar'
          ? `تم إضافة ${d.points} نقطة إلى رصيدك. الإجمالي: ${d.totalPoints}`
          : `${d.points} points added to your balance. Total: ${d.totalPoints}`;
      case 'LOYALTY_REDEEM':
        return lang === 'ar'
          ? `تم استبدال ${d.points} نقطة بقيمة ${d.credit}. المتبقي: ${d.totalPoints}`
          : `Redeemed ${d.points} points for ${d.credit}. Remaining: ${d.totalPoints}`;
      case 'RATING_REQUEST':
        return lang === 'ar'
          ? `نود معرفة رأيك بخدمتنا لحجزك رقم ${d.bookingId}. شاركنا تقييمك وملاحظاتك.`
          : `We'd love your feedback on booking ${d.bookingId}. Please rate your experience.`;
      default:
        return String(d.message || (lang === 'ar' ? 'تنبيه' : 'Notification'));
    }
  }

  /**
   * Get email configuration status for debugging
   */
  getEmailConfigStatus() {
    return this.emailProvider.getConfigStatus();
  }
}


