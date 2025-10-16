import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('admin/coupons')
@Controller()
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  // Admin CRUD
  @Get('admin/coupons')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiBearerAuth()
  list() {
    return this.coupons.list();
  }

  @Post('admin/coupons')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  create(@Body() body: CreateCouponDto) {
    return this.coupons.create({
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Patch('admin/coupons/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: UpdateCouponDto) {
    return this.coupons.update(id, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Delete('admin/coupons/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.coupons.remove(id);
  }

  // Public preview
  @Post('coupons/preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() body: { code: string; amount: number }) {
    return this.coupons.preview(body.code, body.amount);
  }
}


