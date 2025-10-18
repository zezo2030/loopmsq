import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminConfigService } from './admin-config.service';
import { UpdateSmsConfigDto } from './dto/update-sms-config.dto';
import { UpdateOtpConfigDto } from './dto/update-otp-config.dto';

@ApiTags('admin-config')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('admin/config')
export class AdminConfigController {
  constructor(private readonly service: AdminConfigService) {}

  @Get('sms')
  @ApiOperation({ summary: 'Get SMS configuration (masked)' })
  async getSms() {
    return this.service.getSmsConfig(true);
  }

  @Put('sms')
  @ApiOperation({ summary: 'Update SMS configuration' })
  async updateSms(@Body() dto: UpdateSmsConfigDto) {
    return this.service.updateSmsConfig(dto);
  }

  @Post('sms/test')
  @ApiOperation({ summary: 'Send a test SMS message' })
  async testSms(@Body() body: { to: string; message: string }) {
    return this.service.testSms(body.to, body.message);
  }

  @Get('otp')
  @ApiOperation({ summary: 'Get OTP configuration' })
  async getOtp() {
    return this.service.getOtpConfig();
  }

  @Put('otp')
  @ApiOperation({ summary: 'Update OTP configuration' })
  async updateOtp(@Body() dto: UpdateOtpConfigDto) {
    return this.service.updateOtpConfig(dto);
  }
}


