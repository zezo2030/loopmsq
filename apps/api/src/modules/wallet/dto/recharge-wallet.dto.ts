import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../../../database/entities/payment.entity';

export class RechargeWalletDto {
  @ApiProperty({ description: 'Amount to recharge', minimum: 1 })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ 
    enum: PaymentMethod,
    description: 'Payment method for recharge',
    example: PaymentMethod.CREDIT_CARD,
  })
  @IsEnum(PaymentMethod, { message: 'Invalid payment method' })
  method: PaymentMethod;
}
