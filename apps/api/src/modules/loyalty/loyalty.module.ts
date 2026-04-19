import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoyaltyService } from './loyalty.service';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyRule } from '../../database/entities/loyalty-rule.entity';
import { Wallet } from '../../database/entities/wallet.entity';
import { LoyaltyTransaction } from '../../database/entities/loyalty-transaction.entity';
import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { Branch } from '../../database/entities/branch.entity';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LoyaltyRule,
      Wallet,
      LoyaltyTransaction,
      WalletTransaction,
      Branch,
    ]),
    UsersModule,
    NotificationsModule,
  ],
  providers: [LoyaltyService, QRCodeService, RedisService],
  controllers: [LoyaltyController],
  exports: [LoyaltyService],
})
export class LoyaltyModule {}
