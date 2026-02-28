import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEmail, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateAddOnDto {
    @ApiPropertyOptional({ description: 'Add-on ID' })
    @IsOptional()
    @IsString()
    id?: string;

    @ApiPropertyOptional({ description: 'Add-on name' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ description: 'Add-on price' })
    @IsOptional()
    @IsInt()
    @Min(0)
    price?: number;

    @ApiPropertyOptional({ description: 'Quantity' })
    @IsOptional()
    @IsInt()
    @Min(1)
    quantity?: number;
}

export class UpdateTripRequestDto {
    @ApiPropertyOptional({ description: 'Branch ID' })
    @IsOptional()
    @IsUUID()
    branchId?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @Length(2, 200)
    schoolName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10000)
    studentsCount?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000)
    accompanyingAdults?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsDateString()
    preferredDate?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @Length(1, 10)
    preferredTime?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(12)
    durationHours?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @Length(2, 100)
    contactPersonName?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @Length(5, 20)
    contactPhone?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsEmail()
    contactEmail?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @Length(0, 1000)
    specialRequirements?: string;

    @ApiPropertyOptional({ description: 'Add-ons (meals, drinks)', type: Array })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateAddOnDto)
    addOns?: UpdateAddOnDto[];
}
