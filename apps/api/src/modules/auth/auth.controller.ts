import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RegisterSendOtpDto } from './dto/register-send-otp.dto';
import { RegisterVerifyOtpDto } from './dto/register-verify-otp.dto';
import { UserLoginDto } from './dto/user-login.dto';
import { CompleteRegistrationDto } from './dto/complete-registration.dto';
import { StaffLoginDto } from './dto/staff-login.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Post('register/otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send OTP to register with phone number' })
  @ApiResponse({ status: 200, description: 'OTP sent successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'Phone number already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async registerSendOtp(@Body() dto: RegisterSendOtpDto) {
    return this.authService.registerSendOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and login/register user' })
  @ApiResponse({ status: 200, description: 'OTP verified successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Invalid OTP' })
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @Post('register/otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP for registration' })
  @ApiResponse({ status: 200, description: 'OTP verified, requires completion' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Invalid OTP' })
  @ApiResponse({ status: 409, description: 'Phone number already registered' })
  async registerVerifyOtp(@Body() dto: RegisterVerifyOtpDto) {
    return this.authService.registerVerifyOtp(dto);
  }

  @Post('register/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete registration with name and password' })
  @ApiResponse({ status: 200, description: 'Registration completed successfully' })
  @ApiResponse({ status: 400, description: 'Bad request or verification expired' })
  @ApiResponse({ status: 409, description: 'Phone number already registered' })
  async completeRegistration(@Body() dto: CompleteRegistrationDto) {
    return this.authService.completeRegistration(dto);
  }

  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin/Branch Manager/Staff login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async staffLogin(@Body() staffLoginDto: StaffLoginDto) {
    return this.authService.staffLogin(staffLoginDto);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login with phone number and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async userLogin(@Body() dto: UserLoginDto) {
    return this.authService.userLogin(dto);
  }

  @Get('email-config')
  @ApiOperation({ summary: 'Check email configuration status' })
  @ApiResponse({ status: 200, description: 'Email configuration status' })
  async checkEmailConfig() {
    return this.notificationsService.getEmailConfigStatus();
  }

  @Post('language')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user language preference' })
  @ApiResponse({ status: 200, description: 'Language updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async updateLanguage(
    @CurrentUser() user: User,
    @Body('language') language: string,
  ) {
    return this.authService.updateLanguage(user.id, language);
  }
}
