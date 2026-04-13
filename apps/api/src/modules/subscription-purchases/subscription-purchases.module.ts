import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPurchase } from '../../database/entities/subscription-purchase.entity';
import { SubscriptionUsageLog } from '../../database/entities/subscription-usage-log.entity';
import { SubscriptionPlan } from '../../database/entities/subscription-plan.entity';
import { Payment } from '../../database/entities/payment.entity';
import { SubscriptionPurchasesController } from './subscription-purchases.controller';
import { StaffSubscriptionsController } from './staff-subscriptions.controller';
import { SubscriptionPurchasesService } from './subscription-purchases.service';
import { QRCodeService } from '../../utils/qr-code.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../../database/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPurchase,
      SubscriptionUsageLog,
      SubscriptionPlan,
      Payment,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [SubscriptionPurchasesController, StaffSubscriptionsController],
  providers: [SubscriptionPurchasesService, QRCodeService],
  exports: [SubscriptionPurchasesService],
})
export class SubscriptionPurchasesModule {}
