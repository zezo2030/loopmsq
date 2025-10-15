import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CreateEventPackageDto } from './dto/create-event-package.dto';
import { UpdateEventPackageDto } from './dto/update-event-package.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('admin/packages')
@Controller()
export class PackagesController {
  constructor(private readonly packages: PackagesService) {}

  @Get('admin/packages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  list(
    @Query('branchId') branchId?: string,
    @Query('eventType') eventType?: string,
  ) {
    return this.packages.list({ branchId, eventType });
  }

  @Post('admin/packages')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() body: CreateEventPackageDto) {
    return this.packages.create({
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Patch('admin/packages/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: UpdateEventPackageDto) {
    return this.packages.update(id, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Delete('admin/packages/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.packages.remove(id);
  }

  @Post('admin/packages/preview')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  preview(@Body() body: { packageId: string; persons: number; durationHours: number }) {
    return this.packages.preview(body.packageId, body.persons, body.durationHours);
  }
}


