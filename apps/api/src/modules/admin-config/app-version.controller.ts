import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminConfigService } from './admin-config.service';

// Public endpoint consumed by the mobile apps to decide whether a mandatory
// update is required. No authentication — it must be reachable before login.
@ApiTags('app')
@Controller('app')
export class AppVersionController {
  constructor(private readonly service: AdminConfigService) {}

  @Get('version')
  @ApiOperation({
    summary: 'Get minimum required app version for the given platform',
  })
  @ApiQuery({ name: 'platform', required: false, enum: ['android', 'ios'] })
  async getVersion(@Query('platform') platform?: string) {
    return this.service.getPublicAppVersion(platform);
  }
}
