import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeductHoursDto {
  @ApiProperty({
    description: 'Subscription purchase ID',
    example: 'purchase-uuid',
  })
  @IsUUID()
  subscriptionPurchaseId: string;

  @ApiProperty({
    description: 'Hours to deduct (must be multiple of 0.5)',
    example: 1.5,
  })
  @IsNumber()
  @Min(0.5)
  hours: number;

  @ApiProperty({
    description: 'Optional staff notes',
    example: 'Afternoon session',
    required: false,
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
