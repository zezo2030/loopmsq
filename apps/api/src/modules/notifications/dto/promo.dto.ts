import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger'
import { IsArray, IsEmail, IsIn, IsOptional, IsPhoneNumber, IsString, IsUUID, Length } from 'class-validator'

export class PromoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber()
  phone?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string

  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  message!: string

  @ApiPropertyOptional({ enum: ['ar', 'en'] })
  @IsOptional()
  @IsIn(['ar', 'en'])
  lang?: 'ar' | 'en'

  @ApiPropertyOptional({ type: [String], enum: ['sms', 'push', 'email'] })
  @IsOptional()
  @IsArray()
  @IsIn(['sms', 'push', 'email'], { each: true })
  channels?: Array<'sms' | 'push' | 'email'>
}


