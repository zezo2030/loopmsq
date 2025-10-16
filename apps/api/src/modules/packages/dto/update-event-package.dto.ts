import { PartialType } from '@nestjs/swagger';
import { CreateEventPackageDto } from './create-event-package.dto';

export class UpdateEventPackageDto extends PartialType(CreateEventPackageDto) {}


