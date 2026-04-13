import { PartialType } from '@nestjs/swagger';
import { CreateOfferProductDto } from './create-offer-product.dto';

export class UpdateOfferProductDto extends PartialType(CreateOfferProductDto) {}
