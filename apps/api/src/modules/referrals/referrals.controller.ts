import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { CreateReferralCodeDto } from './dto/create-code.dto';
import { ListCodesDto } from './dto/list-codes.dto';
import { AttributeReferralDto } from './dto/attribute.dto';
import { ListEarningsDto } from './dto/list-earnings.dto';
import { ApproveEarningDto } from './dto/approve-earning.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('referrals')
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Post('codes')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update referral code for user (Admin only)' })
  async createCode(@Body() dto: CreateReferralCodeDto) {
    return this.referrals.createCode(dto);
  }

  @Get('codes')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List referral codes (Admin only)' })
  async listCodes(@Query() query: ListCodesDto) {
    return this.referrals.listCodes(query);
  }

  @Post('attribute')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attribute referral to current user' })
  async attribute(@CurrentUser() user: User, @Body() dto: AttributeReferralDto) {
    return this.referrals.attribute(user.id, dto);
  }

  @Get('earnings')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List referral earnings (Admin only)' })
  async listEarnings(@Query() query: ListEarningsDto) {
    return this.referrals.listEarnings(query);
  }

  @Post('earnings/:id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve referral earning and credit wallet (Admin only)' })
  async approve(@Param('id') id: string, @Body() dto: ApproveEarningDto) {
    return this.referrals.approveEarning(id, dto);
  }
}


