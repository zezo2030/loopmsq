import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HomeAdminService } from './home-admin.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';

@ApiTags('admin/offers')
@Controller('admin/offers')
export class OfferAdminController {
  constructor(private readonly svc: HomeAdminService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  list() { return this.svc.listOffers(); }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() body: any) { return this.svc.createOffer(body); }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() body: any) { return this.svc.updateOffer(id, body); }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) { return this.svc.deleteOffer(id); }
}


