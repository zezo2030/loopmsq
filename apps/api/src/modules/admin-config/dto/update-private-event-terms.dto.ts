import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdatePrivateEventTermsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @IsOptional()
  terms?: string[];
}
