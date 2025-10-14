import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';
import { ReferralCode } from '../../database/entities/referral-code.entity';
import { ReferralAttribution } from '../../database/entities/referral-attribution.entity';
import { ReferralEarning } from '../../database/entities/referral-earning.entity';
import { UsersModule } from '../users/users.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReferralCode, ReferralAttribution, ReferralEarning]),
    UsersModule,
    LoyaltyModule,
  ],
  providers: [ReferralsService],
  controllers: [ReferralsController],
  exports: [ReferralsService],
})
export class ReferralsModule {}


