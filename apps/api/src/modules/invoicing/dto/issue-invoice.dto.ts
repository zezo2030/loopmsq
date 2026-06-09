import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  EInvoiceDocumentType,
  EInvoiceType,
} from '../../../database/entities/einvoice.entity';

export class InvoiceLineDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsNumber() @IsPositive() quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiProperty({ example: 15 }) @IsNumber() @Min(0) vatRate: number;
  @ApiPropertyOptional({ enum: ['S', 'Z', 'E', 'O'] })
  @IsOptional()
  @IsString()
  vatCategory?: 'S' | 'Z' | 'E' | 'O';
  @ApiPropertyOptional() @IsOptional() @IsString() unitCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) discount?: number;
}

export class InvoiceCustomerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() vatNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() identityScheme?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() identityValue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() street?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() buildingNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() plotIdentification?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() citySubdivision?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() postalZone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() countrySubentity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() countryCode?: string;
}

export class IssueInvoiceDto {
  @ApiProperty({ enum: EInvoiceType })
  @IsEnum(EInvoiceType)
  type: EInvoiceType;

  @ApiPropertyOptional({ enum: EInvoiceDocumentType })
  @IsOptional()
  @IsEnum(EInvoiceDocumentType)
  documentType?: EInvoiceDocumentType;

  @ApiProperty({ type: [InvoiceLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];

  @ApiPropertyOptional({ type: InvoiceCustomerDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceCustomerDto)
  customer?: InvoiceCustomerDto;

  @ApiPropertyOptional({ description: 'Link this invoice to an existing payment' })
  @IsOptional()
  @IsString()
  paymentId?: string;

  @ApiPropertyOptional({ description: 'For credit/debit notes: original invoice number' })
  @IsOptional()
  @IsString()
  originalInvoiceNumber?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() noteReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() currency?: string;
}
