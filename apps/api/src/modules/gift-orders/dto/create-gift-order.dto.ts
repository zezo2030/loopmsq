import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsUUID,
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  MaxLength,
  ValidateNested,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GiftType } from '../../../database/entities/gift-order.entity';
import { PaymentMethod } from '../../../database/entities/payment.entity';

class CreateGiftAddOnDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateGiftOrderDto {
  @ApiProperty({ enum: GiftType })
  @IsEnum(GiftType)
  giftType: GiftType;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  sourceProductId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  branchId: string;

  @ApiProperty()
  @IsString()
  recipientPhone: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  showSenderInfo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  giftMessage?: string;

  @ApiPropertyOptional({ type: [CreateGiftAddOnDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGiftAddOnDto)
  addOns?: CreateGiftAddOnDto[];

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
