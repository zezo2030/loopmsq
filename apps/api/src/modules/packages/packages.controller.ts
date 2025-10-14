import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CreateEventPackageDto } from './dto/create-event-package.dto';
import { UpdateEventPackageDto } from './dto/update-event-package.dto';

@ApiTags('admin/packages')
@Controller()
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get('admin/packages')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  list(
    @Query('branchId') branchId?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.packages.list({ branchId, eventType });
  }

  @Post('admin/packages')
  @Roles(UserRole.ADMIN)
  create(@Body() body: CreateEventPackageDto) {
    return this.packages.create({
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Patch('admin/packages/:id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateEventPackageDto) {
    return this.packages.update(id, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Delete('admin/packages/:id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.packages.remove(id);
  }

  @Post('admin/packages/preview')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  preview(@Body() body: { packageId: string; persons: number; durationHours: number }) {
    return this.packages.preview(body.packageId, body.persons, body.durationHours);
  }
}


