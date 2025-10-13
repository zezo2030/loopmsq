import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LoyaltyService } from './loyalty.service';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyalty: LoyaltyService) {}

  @Get()
  async getSummary(@Body() body: { userId: string }) {
    return this.loyalty.getSummary(body.userId);
  }

  @Post('redeem')
  @HttpCode(HttpStatus.OK)
  async redeem(@Body() body: { userId: string; points: number }) {
    return this.loyalty.redeemPoints(body.userId, body.points);
  }

  // Admin endpoints (assume guarded by roles at controller level later)
  @Get('rules')
  async listRules() {
    return this.loyalty.listRules();
  }

  @Post('rules')
  async createRule(@Body() body: { earnRate?: number; redeemRate?: number; minRedeemPoints?: number; isActive?: boolean }) {
    return this.loyalty.createRule(body);
  }

  @Post('rules/:id/activate')
  @HttpCode(HttpStatus.OK)
  async activateRule(@Param('id') id: string) {
    await this.loyalty.setActiveRule(id);
    return { success: true };
  }
}


