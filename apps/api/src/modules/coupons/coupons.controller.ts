import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards, Query, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
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
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  list(@Query('branchId') branchId?: string, @CurrentUser() me?: User) {
    if (me?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      const enforcedBranchId = me.branchId;
      if (!enforcedBranchId) throw new ForbiddenException('No branch assigned');
      return this.coupons.list({ branchId: enforcedBranchId });
    }
    return this.coupons.list(branchId ? { branchId } : undefined);
  }

  @Post('admin/coupons')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  create(@Body() body: CreateCouponDto, @CurrentUser() me: User) {
    if (me?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!me.branchId) throw new ForbiddenException('No branch assigned');
      if (body.branchId && body.branchId !== me.branchId) {
        throw new ForbiddenException('Not allowed for other branches');
      }
      (body as any).branchId = me.branchId;
    }
    return this.coupons.create({
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Patch('admin/coupons/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() body: UpdateCouponDto, @CurrentUser() me: User) {
    if (me?.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!me.branchId) throw new ForbiddenException('No branch assigned');
      if ((body as any).branchId && (body as any).branchId !== me.branchId) {
        throw new ForbiddenException('Not allowed for other branches');
      }
      (body as any).branchId = me.branchId as any;
    }
    return this.coupons.update(id, {
      ...body,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  }

  @Delete('admin/coupons/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
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


