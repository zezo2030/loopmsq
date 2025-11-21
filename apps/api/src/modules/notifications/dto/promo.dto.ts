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

  @ApiPropertyOptional({ type: [String], enum: ['push'], description: 'القنوات - حالياً فقط push مدعوم' })
  @IsOptional()
  @IsArray()
  @IsIn(['push'], { each: true })
  channels?: Array<'push'>
}


