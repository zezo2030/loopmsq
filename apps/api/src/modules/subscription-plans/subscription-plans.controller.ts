import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { SubscriptionPlansService } from './subscription-plans.service';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';

@ApiTags('subscription-plans')
@Controller()
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class SubscriptionPlansController {
  constructor(private readonly service: SubscriptionPlansService) {}

  @Get('branches/:branchId/subscription-plans')
  @ApiOperation({ summary: 'List active subscription plans for a branch' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async getBranchSubscriptionPlans(
    @Param('branchId', ParseUUIDPipe) branchId: string,
  ) {
    return this.service.findActiveByBranch(branchId);
  }

  @Get('admin/subscription-plans')
  @ApiOperation({ summary: 'List all subscription plans (admin)' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAdminSubscriptionPlans(
    @Query('branchId') branchId?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.service.findAll({
      branchId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      plans: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Post('admin/subscription-plans')
  @ApiOperation({ summary: 'Create a new subscription plan (admin)' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createAdminSubscriptionPlan(@Body() dto: CreateSubscriptionPlanDto) {
    return this.service.create(dto);
  }

  @Patch('admin/subscription-plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan (admin)' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failure' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updateAdminSubscriptionPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete('admin/subscription-plans/:id')
  @ApiOperation({ summary: 'Soft-delete a subscription plan (admin)' })
  @ApiResponse({ status: 200, description: 'Plan deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async deleteAdminSubscriptionPlan(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.softDelete(id);
    return {
      success: true,
      message: 'Plan deactivated. Existing subscriptions remain active.',
    };
  }

  @Post('admin/subscription-plans/:id/upload-cover')
  @ApiOperation({ summary: 'Upload subscription plan cover image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 200,
    description: 'Cover image uploaded successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsRootCandidates = [
            process.env.UPLOAD_DEST,
            join(__dirname, '..', '..', '..', 'uploads'),
            join(__dirname, '..', 'uploads'),
          ].filter(Boolean) as string[];
          const uploadsRoot =
            uploadsRootCandidates.find((p) => {
              try {
                return !!p && existsSync(p);
              } catch {
                return false;
              }
            }) || uploadsRootCandidates[0];
          const target = join(uploadsRoot, 'subscription-plans');
          try {
            mkdirSync(target, { recursive: true });
          } catch {}
          cb(null, target);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `cover-${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadCoverImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadCoverImage(id, file.filename);
  }
}
