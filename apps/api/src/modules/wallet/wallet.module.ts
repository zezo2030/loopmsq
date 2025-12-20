import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { Wallet } from '../../database/entities/wallet.entity';
import { WalletTransaction } from '../../database/entities/wallet-transaction.entity';
import { User } from '../../database/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TapService } from '../../integrations/tap/tap.service';
import { EncryptionService } from '../../utils/encryption.util';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Wallet, WalletTransaction, User]),
    NotificationsModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, TapService, EncryptionService],
  exports: [WalletService],
})
export class WalletModule {}
