import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { DeviceToken } from '../../database/entities/device-token.entity';
import { Notification } from '../../database/entities/notification.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { normalizePhone } from '../../utils/phone.util';
import { EmailProvider } from './providers/email.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';

export type NotificationChannel = 'sms' | 'email' | 'push' | 'whatsapp';

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
    | 'LOYALTY_TICKET_REDEEMED'
    | 'RATING_REQUEST'
    | 'WALLET_RECHARGED'
    | 'WALLET_REWARD_CREDITED'
    | 'OFFER_PURCHASE_SUCCESS'
    | 'SUBSCRIPTION_PURCHASE_SUCCESS'
    | 'GIFT_INVITE'
    | 'GIFT_CLAIMED'
    | 'GIFT_EXPIRED';
  to: { phone?: string; email?: string; userId?: string };
  template?: string;
  data: Record<string, unknown>;
  lang?: 'ar' | 'en';
  channels: NotificationChannel[];
  delayMs?: number;
  jobId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue('notifications_sms') private readonly smsQueue: Queue,
    @InjectQueue('notifications_email') private readonly emailQueue: Queue,
    @InjectQueue('notifications_push') private readonly pushQueue: Queue,
    @InjectQueue('notifications_whatsapp')
    private readonly whatsappQueue: Queue,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(DeviceToken)
    private readonly tokenRepo: Repository<DeviceToken>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly encryption: EncryptionService,
    private readonly emailProvider: EmailProvider,
    private readonly whatsappProvider: WhatsAppProvider,
  ) {}

  async enqueue(n: EnqueueNotification): Promise<void> {
    const resolved = await this.resolveRecipient(n.to);
    const targetUserId = resolved.userId || n.to.userId;
    const lang = n.lang || resolved.lang || 'ar';
    const jobs: Promise<any>[] = [];

    // Save to database if userId is provided
    if (targetUserId) {
      const title = this.renderSubject(n, lang);
      const body = this.renderTemplate(n, 'email', lang); // full body
      const notification = this.notificationRepo.create({
        userId: targetUserId,
        title,
        body,
        type: n.type,
        data: n.data,
        isRead: false,
      });
      await this.notificationRepo.save(notification);
    }

    if (n.channels.includes('sms') && (n.to.phone || resolved.phone)) {
      const body = this.renderTemplate(n, 'sms', lang);
      jobs.push(
        this.smsQueue.add(
          'send',
          {
            to: n.to.phone || resolved.phone!,
            body,
            meta: { type: n.type, lang },
          },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            ...(n.delayMs ? { delay: n.delayMs } : {}),
            ...(n.jobId ? { jobId: n.jobId } : {}),
          },
        ),
      );
    }

    if (n.channels.includes('email') && (n.to.email || resolved.email)) {
      const subject = this.renderSubject(n, lang);
      const html = this.renderTemplate(n, 'email', lang);
      jobs.push(
        this.emailQueue.add(
          'send',
          {
            to: n.to.email || resolved.email!,
            subject,
            html,
            meta: { type: n.type, lang },
          },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            ...(n.delayMs ? { delay: n.delayMs } : {}),
            ...(n.jobId ? { jobId: n.jobId } : {}),
          },
        ),
      );
    }

    if (n.channels.includes('whatsapp') && (n.to.phone || resolved.phone)) {
      if (n.type === 'OTP') {
        jobs.push(
          this.whatsappQueue.add(
            'send',
            {
              to: n.to.phone || resolved.phone!,
              otp: String(n.data.otp),
              lang,
            },
            {
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: true,
              ...(n.delayMs ? { delay: n.delayMs } : {}),
              ...(n.jobId ? { jobId: n.jobId } : {}),
            },
          ),
        );
      } else if (n.type === 'GIFT_INVITE') {
        jobs.push(
          this.whatsappQueue.add(
            'send',
            {
              to: n.to.phone || resolved.phone!,
              type: 'gift_invite',
              data: n.data,
              lang,
            },
            {
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: true,
              ...(n.delayMs ? { delay: n.delayMs } : {}),
              ...(n.jobId ? { jobId: n.jobId } : {}),
            },
          ),
        );
      }
    }

    if (n.channels.includes('push')) {
      // إذا لم يتم تحديد مستخدم، أرسل لجميع الأجهزة
      const tokens = targetUserId
        ? await this.getUserTokens(targetUserId, resolved.phone)
        : await this.getAllDeviceTokens();
      if (tokens.length) {
        const title = this.renderSubject(n, lang);
        const body = this.renderTemplate(n, 'sms', lang); // concise body for push
        jobs.push(
          this.pushQueue.add(
            'send',
            { tokens, title, body, data: this.buildPushData(n) },
            {
              attempts: 5,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: true,
              ...(n.delayMs ? { delay: n.delayMs } : {}),
              ...(n.jobId ? { jobId: n.jobId } : {}),
            },
          ),
        );
      }
    }

    await Promise.all(jobs);
  }

  async cancelScheduledForBooking(bookingId: string) {
    const jobIds = [
      `booking:${bookingId}:reminder:24h`,
      `booking:${bookingId}:reminder:2h`,
      `booking:${bookingId}:end`,
      `booking:${bookingId}:rating`,
    ];
    await Promise.all([
      ...jobIds.map((id) => this.smsQueue.removeJobs(id)),
      ...jobIds.map((id) => this.emailQueue.removeJobs(id)),
      ...jobIds.map((id) => this.pushQueue.removeJobs(id)),
      ...jobIds.map((id) => this.whatsappQueue.removeJobs(id)),
    ]);
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
    isRead?: boolean,
  ) {
    const query = this.notificationRepo
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId })
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (isRead !== undefined) {
      query.andWhere('notification.isRead = :isRead', { isRead });
    }

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(id: string, userId: string): Promise<void> {
    await this.notificationRepo.update({ id, userId }, { isRead: true });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    await this.notificationRepo.delete({ id, userId });
  }

  async deleteAllNotifications(userId: string): Promise<void> {
    await this.notificationRepo.delete({ userId });
  }

  private async resolveRecipient(to: {
    phone?: string;
    email?: string;
    userId?: string;
  }): Promise<{
    phone?: string;
    email?: string;
    lang?: 'ar' | 'en';
    userId?: string;
  }> {
    if (to.userId) {
      const user = await this.userRepo.findOne({ where: { id: to.userId } });
      if (user) {
        let phone: string | undefined;
        try {
          phone = user.phone ? this.encryption.decrypt(user.phone) : undefined;
        } catch {
          phone = undefined;
        }
        return {
          userId: user.id,
          phone,
          email: user.email || undefined,
          lang: (user.language as any) || undefined,
        };
      }
    }

    if (to.phone) {
      const matchedUser = await this.findUserByPhone(to.phone);
      if (matchedUser) {
        return {
          userId: matchedUser.id,
          phone: to.phone,
          email: matchedUser.email || to.email,
          lang: (matchedUser.language as any) || undefined,
        };
      }
    }

    return { phone: to.phone, email: to.email };
  }

  private async findUserByPhone(phone: string): Promise<User | null> {
    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch {
      return null;
    }

    const users = await this.userRepo
      .createQueryBuilder('user')
      .where('user.phone IS NOT NULL')
      .getMany();

    for (const user of users) {
      try {
        const decrypted = user.phone ? this.encryption.decrypt(user.phone) : '';
        if (decrypted && normalizePhone(decrypted) === normalized) {
          return user;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private async getUserTokens(
    userId?: string,
    _phone?: string,
  ): Promise<string[]> {
    if (!userId) return [];
    const list = await this.tokenRepo.find({ where: { userId } });
    return list.map((t) => t.token);
  }

  private async getAllDeviceTokens(): Promise<string[]> {
    const list = await this.tokenRepo.find();
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
    const d = n.data as any;
    if (false && n.type === 'GIFT_INVITE') {
      return lang === 'ar' ? 'وصلتك هدية جديدة!' : 'You received a gift!';
    }
    switch (n.type) {
      case 'OTP':
        return lang === 'ar' ? 'رمز التحقق' : 'Your OTP Code';
      case 'BOOKING_CONFIRMED':
        return lang === 'ar' ? 'تأكيد الحجز' : 'Booking Confirmed';
      case 'BOOKING_REMINDER':
        return lang === 'ar' ? 'تذكير بالحجز' : 'Booking Reminder';
      case 'BOOKING_END':
        return lang === 'ar' ? 'انتهاء الحجز' : 'Booking Ended';
      case 'LOYALTY_TICKET_REDEEMED':
        return lang === 'ar'
          ? 'تذكرة من نقاط الولاء'
          : 'Free ticket from loyalty points';
      case 'RATING_REQUEST':
        return lang === 'ar' ? 'تقييم تجربتك' : 'Rate Your Experience';
      case 'BOOKING_CANCELLED':
        return lang === 'ar' ? 'إلغاء الحجز' : 'Booking Cancelled';
      case 'PAYMENT_SUCCESS':
        return lang === 'ar' ? 'تم الدفع بنجاح' : 'Payment Successful';
      case 'WALLET_RECHARGED':
        return lang === 'ar' ? 'شحن المحفظة' : 'Wallet Recharged';
      case 'WALLET_REWARD_CREDITED':
        return lang === 'ar' ? 'رصيد مكافأة' : 'Reward balance';
      case 'TICKETS_ISSUED':
        return lang === 'ar' ? 'إصدار التذاكر' : 'Tickets Issued';
      case 'TRIP_STATUS':
        return lang === 'ar' ? 'حالة طلب الرحلة' : 'Trip Request Status';
      case 'EVENT_STATUS':
        return lang === 'ar' ? 'حالة طلب المناسبة' : 'Event Request Status';
      case 'OFFER_PURCHASE_SUCCESS':
        return lang === 'ar'
          ? 'تم شراء العرض بنجاح'
          : 'Offer Purchase Confirmed';
      case 'SUBSCRIPTION_PURCHASE_SUCCESS':
        return lang === 'ar'
          ? 'تم شراء الاشتراك بنجاح'
          : 'Subscription Purchase Confirmed';
      case 'GIFT_INVITE':
        return lang === 'ar' ? 'لقد received هدية!' : 'You received a gift!';
      case 'GIFT_CLAIMED':
        return lang === 'ar' ? 'تم استلام الهدية' : 'Gift Claimed';
      case 'GIFT_EXPIRED':
        return lang === 'ar' ? 'انتهت صلاحية الهدية' : 'Gift Expired';
      default:
        return lang === 'ar' ? 'تنبيه' : 'Notification';
    }
  }

  private renderTemplate(
    n: EnqueueNotification,
    channel: NotificationChannel | 'email',
    lang: 'ar' | 'en',
  ): string {
    if (n.template) return n.template;
    const d = n.data as any;
    if (false && n.type === 'GIFT_INVITE') {
      return lang === 'ar'
          ? [
              `أرسل ${d.senderName || 'شخص'} لك هدية: ${d.productTitle} من ${d.branchName}.`,
              d.giftMessage ? `الرسالة: ${d.giftMessage}` : null,
              'افتح تفاصيل الهدية الآن.',
            ]
              .filter(Boolean)
              .join(' ')
          : [
              `${d.senderName || 'Someone'} sent you a gift: ${d.productTitle} from ${d.branchName}.`,
              d.giftMessage ? `Message: ${d.giftMessage}` : null,
              'Open gift details now.',
            ]
              .filter(Boolean)
              .join(' ');
    }
    switch (n.type) {
      case 'OTP':
        return lang === 'ar'
          ? `رمز التحقق الخاص بك: ${d.otp}`
          : `Your OTP code is: ${d.otp}`;
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
          ? d.welcomeMessage ||
              `تم إصدار التذاكر لحجزك ${d.bookingId}. نتمنى لك وقتاً ممتعاً!`
          : d.welcomeMessage ||
              `Tickets issued for booking ${d.bookingId}. Enjoy!`;
      case 'TRIP_STATUS':
        return lang === 'ar'
          ? `تم تحديث حالة طلب الرحلة إلى: ${d.status}`
          : `Trip request status updated to: ${d.status}`;
      case 'EVENT_STATUS':
        return lang === 'ar'
          ? `تم تحديث حالة طلب المناسبة إلى: ${d.status}`
          : `Event request status updated to: ${d.status}`;
      case 'PROMO':
        return String(
          d.message || (lang === 'ar' ? 'عرض ترويجي' : 'Promotion'),
        );
      case 'ADMIN_MESSAGE':
        return String(
          d.message || (lang === 'ar' ? 'رسالة من الإدارة' : 'Admin Message'),
        );
      case 'LOYALTY_EARN':
        return lang === 'ar'
          ? `تم إضافة ${d.points} نقطة إلى رصيدك. الإجمالي: ${d.totalPoints}`
          : `${d.points} points added to your balance. Total: ${d.totalPoints}`;
      case 'LOYALTY_REDEEM':
        return lang === 'ar'
          ? `تم استبدال ${d.points} نقطة بقيمة ${d.credit}. المتبقي: ${d.totalPoints}`
          : `Redeemed ${d.points} points for ${d.credit}. Remaining: ${d.totalPoints}`;
      case 'LOYALTY_TICKET_REDEEMED':
        return lang === 'ar'
          ? `تم استبدال ${d.pointsRedeemed} نقطة مقابل تذكرة مجانية في ${d.branchName || d.branchId}. رصيد النقاط المتبقي: ${d.totalPoints}.`
          : `Redeemed ${d.pointsRedeemed} points for a free ticket at ${d.branchName || d.branchId}. Remaining points: ${d.totalPoints}.`;
      case 'RATING_REQUEST':
        return lang === 'ar'
          ? `نود معرفة رأيك بخدمتنا لحجزك رقم ${d.bookingId}. شاركنا تقييمك وملاحظاتك.`
          : `We'd love your feedback on booking ${d.bookingId}. Please rate your experience.`;
      case 'WALLET_RECHARGED':
        return lang === 'ar'
          ? `تم شحن محفظتك بمبلغ ${d.amount} ${d.currency || 'SAR'}. الرصيد الحالي: ${d.balance || 0} ${d.currency || 'SAR'}.`
          : `Your wallet has been recharged with ${d.amount} ${d.currency || 'SAR'}. Current balance: ${d.balance || 0} ${d.currency || 'SAR'}.`;
      case 'WALLET_REWARD_CREDITED':
        return lang === 'ar'
          ? `تم تعبئة رصيد المكافأة بقيمة ${d.amount} ${d.currency || 'SAR'}. رصيد محفظتك الحالي: ${d.balance ?? 0} ${d.currency || 'SAR'}.`
          : `Your reward balance was topped up with ${d.amount} ${d.currency || 'SAR'}. Current wallet balance: ${d.balance ?? 0} ${d.currency || 'SAR'}.`;
      case 'OFFER_PURCHASE_SUCCESS':
        return lang === 'ar'
          ? `تم شراء العرض "${d.offerTitle}" بنجاح! تم إصدار ${d.ticketCount} تذكرة.`
          : `You purchased the offer "${d.offerTitle}" successfully! ${d.ticketCount} ticket(s) issued.`;
      case 'SUBSCRIPTION_PURCHASE_SUCCESS':
        return lang === 'ar'
          ? `تم شراء الاشتراك "${d.planTitle}" بنجاح! ساعاتك: ${d.totalHours}.`
          : `You purchased the subscription "${d.planTitle}" successfully! Your hours: ${d.totalHours}.`;
      case 'GIFT_INVITE':
        return lang === 'ar'
          ? `لقد أرسل ${d.senderName || 'شخص'} لك هدية: ${d.productTitle} من ${d.branchName}. استلمها الآن! ${d.deepLinkUrl || ''}`
          : `${d.senderName || 'Someone'} sent you a gift: ${d.productTitle} from ${d.branchName}. Claim it now! ${d.deepLinkUrl || ''}`;
      case 'GIFT_CLAIMED':
        return lang === 'ar'
          ? `تم استلام هديتك "${d.productTitle}" بنجاح!`
          : `Your gift "${d.productTitle}" has been claimed!`;
      case 'GIFT_EXPIRED':
        return lang === 'ar'
          ? `انتهت صلاحية هديتك "${d.productTitle}". تم بدء عملية الاسترداد.`
          : `Your gift "${d.productTitle}" has expired. A refund has been initiated.`;
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
