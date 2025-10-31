import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseBoolPipe,
  ForbiddenException,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import { ContentService } from './content.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateHallDto } from './dto/create-hall.dto';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';
import { CreateAddonDto } from './dto/create-addon.dto';
import { UpdateAddonDto } from './dto/update-addon.dto';

@ApiTags('content')
@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  // Branch endpoints
  @Post('branches')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new branch (Admin only)' })
  @ApiResponse({ status: 201, description: 'Branch created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createBranch(@Body() createBranchDto: CreateBranchDto) {
    return this.contentService.createBranch(createBranchDto);
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get all branches' })
  @ApiQuery({ name: 'includeInactive', required: false, type: String, description: 'true|false|1|0' })
  @ApiResponse({ status: 200, description: 'Branches retrieved successfully' })
  async findAllBranches(
    @Query('includeInactive') includeInactive?: string,
  ) {
    const includeInactiveBool = includeInactive === 'true' || includeInactive === '1' || includeInactive === 'yes';
    return this.contentService.findAllBranches(includeInactiveBool);
  }

  @Get('branches/:id')
  @ApiOperation({ summary: 'Get branch by ID' })
  @ApiResponse({ status: 200, description: 'Branch retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async findBranchById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.findBranchById(id);
  }

  @Put('branches/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update branch (Admin only)' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async updateBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateBranchDto>,
    @CurrentUser() requester: User,
  ) {
    // Branch manager may only update their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || requester.branchId !== id) {
        throw new ForbiddenException('Not allowed');
      }
    }
    return this.contentService.updateBranch(id, updateData);
  }

  @Patch('branches/:id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update branch status (Admin/Staff only)' })
  @ApiResponse({
    status: 200,
    description: 'Branch status updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async updateBranchStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'active' | 'inactive' | 'maintenance',
  ) {
    return this.contentService.updateBranchStatus(id, status);
  }

  @Post('branches/:id/upload-cover')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload branch cover image' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Cover image uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Resolve uploads root with env override, then ensure branches subdir
          const uploadsRootCandidates = [
            process.env.UPLOAD_DEST,
            join(__dirname, '..', '..', '..', 'uploads'),
            join(__dirname, '..', 'uploads'),
          ].filter(Boolean) as string[];
          const uploadsRoot = uploadsRootCandidates.find((p) => {
            try { return !!p && fs.existsSync(p); } catch { return false; }
          }) || uploadsRootCandidates[0];
          const target = join(uploadsRoot, 'branches');
          try { fs.mkdirSync(target, { recursive: true }); } catch {}
          cb(null, target);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `cover-${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadBranchCover(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() requester: User,
  ) {
    // Branch manager may only upload to their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || requester.branchId !== id) {
        throw new ForbiddenException('Not allowed');
      }
    }
    return this.contentService.uploadBranchCoverImage(id, file.filename);
  }

  @Post('branches/:id/upload-images')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload branch additional images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsRootCandidates = [
            process.env.UPLOAD_DEST,
            join(__dirname, '..', '..', '..', 'uploads'),
            join(__dirname, '..', 'uploads'),
          ].filter(Boolean) as string[];
          const uploadsRoot = uploadsRootCandidates.find((p) => {
            try { return !!p && fs.existsSync(p); } catch { return false; }
          }) || uploadsRootCandidates[0];
          const target = join(uploadsRoot, 'branches');
          try { fs.mkdirSync(target, { recursive: true }); } catch {}
          cb(null, target);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `img-${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadBranchImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() requester: User,
  ) {
    // Branch manager may only upload to their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || requester.branchId !== id) {
        throw new ForbiddenException('Not allowed');
      }
    }
    const filenames = files.map(file => file.filename);
    return this.contentService.uploadBranchImages(id, filenames);
  }

  @Post('halls/:id/upload-images')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload hall images' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Images uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsRootCandidates = [
            process.env.UPLOAD_DEST,
            join(__dirname, '..', '..', '..', 'uploads'),
            join(__dirname, '..', 'uploads'),
          ].filter(Boolean) as string[];
          const uploadsRoot = uploadsRootCandidates.find((p) => {
            try { return !!p && fs.existsSync(p); } catch { return false; }
          }) || uploadsRootCandidates[0];
          const target = join(uploadsRoot, 'halls');
          try { fs.mkdirSync(target, { recursive: true }); } catch {}
          cb(null, target);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `img-${unique}${extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadHallImages(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() requester: User,
  ) {
    // Branch manager may only upload to halls in their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      const hall = await this.contentService.findHallById(id);
      if (!requester.branchId || hall.branchId !== requester.branchId) {
        throw new ForbiddenException('Not allowed');
      }
    }
    const filenames = files.map((file) => file.filename);
    return this.contentService.uploadHallImages(id, filenames);
  }

  @Delete('halls/:id/images/:filename')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an image from a hall' })
  async deleteHallImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('filename') filename: string,
    @CurrentUser() requester: User,
  ) {
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      const hall = await this.contentService.findHallById(id);
      if (!requester.branchId || hall.branchId !== requester.branchId) {
        throw new ForbiddenException('Not allowed');
      }
    }
    return this.contentService.deleteHallImage(id, filename);
  }

  @Delete('branches/:id/images/:filename')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete branch image' })
  @ApiResponse({ status: 200, description: 'Image deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async deleteBranchImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('filename') filename: string,
    @CurrentUser() requester: User,
  ) {
    // Branch manager may only delete from their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId || requester.branchId !== id) {
        throw new ForbiddenException('Not allowed');
      }
    }
    return this.contentService.deleteBranchImage(id, filename);
  }

  // Hall endpoints
  @Post('halls')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new hall (Admin only)' })
  @ApiResponse({ status: 201, description: 'Hall created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async createHall(@Body() createHallDto: CreateHallDto, @CurrentUser() requester: User) {
    // Force branchId to requester's branch for branch managers
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      if (!requester.branchId) {
        throw new ForbiddenException('Not allowed');
      }
      createHallDto.branchId = requester.branchId as any;
    }
    return this.contentService.createHall(createHallDto);
  }

  @Get('halls')
  @ApiOperation({ summary: 'Get all halls' })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Halls retrieved successfully' })
  async findAllHalls(@Query('branchId') branchId?: string) {
    return this.contentService.findAllHalls(branchId);
  }

  @Get('halls/:id')
  @ApiOperation({ summary: 'Get hall by ID' })
  @ApiResponse({ status: 200, description: 'Hall retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async findHallById(@Param('id', ParseUUIDPipe) id: string) {
    return this.contentService.findHallById(id);
  }

  @Put('halls/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update hall (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hall updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async updateHall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateHallDto>,
    @CurrentUser() requester: User,
  ) {
    // Branch manager can only update halls in their own branch
    if (requester.roles?.includes(UserRole.BRANCH_MANAGER)) {
      const hall = await this.contentService.findHallById(id);
      if (!requester.branchId || hall.branchId !== requester.branchId) {
        throw new ForbiddenException('Not allowed');
      }
      // Prevent moving hall to another branch
      if (updateData && (updateData as any).branchId && (updateData as any).branchId !== requester.branchId) {
        throw new ForbiddenException('Not allowed');
      }
    }
    return this.contentService.updateHall(id, updateData);
  }

  @Patch('halls/:id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update hall status (Admin/Staff only)' })
  @ApiResponse({ status: 200, description: 'Hall status updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async updateHallStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: 'available' | 'maintenance' | 'reserved',
  ) {
    return this.contentService.updateHallStatus(id, status);
  }

  @Delete('halls/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete hall (Any authenticated user)' })
  @ApiResponse({ status: 200, description: 'Hall deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async deleteHall(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.contentService.deleteHall(id);
    return { success: true };
  }

  // Utility endpoints
  @Get('halls/:id/availability')
  @ApiOperation({ summary: 'Check hall availability' })
  @ApiQuery({ name: 'startTime', type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'durationHours', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Availability checked successfully',
  })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async checkHallAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startTime') startTime: string,
    @Query('durationHours', ParseIntPipe) durationHours: number,
  ) {
    try {
      const startDate = new Date(startTime);
      const isAvailable = await this.contentService.checkHallAvailability(
        id,
        startDate,
        durationHours,
      );

      return { available: isAvailable };
    } catch (error) {
      console.error('Error in checkHallAvailability controller:', error);
      return { available: true }; // Fallback to allow booking
    }
  }

  @Get('halls/:id/pricing')
  @ApiOperation({ summary: 'Calculate hall pricing' })
  @ApiQuery({ name: 'startTime', type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'durationHours', type: Number })
  @ApiQuery({ name: 'persons', type: Number })
  @ApiResponse({ status: 200, description: 'Pricing calculated successfully' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async calculateHallPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startTime') startTime: string,
    @Query('durationHours', ParseIntPipe) durationHours: number,
    @Query('persons', ParseIntPipe) persons: number,
  ) {
    const startDate = new Date(startTime);
    return this.contentService.calculateHallPrice(
      id,
      startDate,
      durationHours,
      persons,
    );
  }

  @Get('halls/:id/addons')
  @ApiOperation({ summary: 'List available add-ons for a hall' })
  @ApiResponse({ status: 200, description: 'Add-ons retrieved successfully' })
  async getHallAddOns(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.contentService.getHallAddOns(id);
  }

  // Admin: Addons CRUD
  @Post('admin/addons')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create addon (admin)' })
  async createAddon(@Body() dto: CreateAddonDto) {
    return this.contentService.createAddon(dto);
  }

  @Get('admin/addons')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List addons (admin)' })
  async listAddons(
    @Query('branchId') branchId?: string,
    @Query('hallId') hallId?: string,
    @Query('isActive') isActiveParam?: string,
  ) {
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;
    return this.contentService.listAddons({ branchId, hallId, isActive });
  }

  @Put('admin/addons/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update addon (admin)' })
  async updateAddon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAddonDto,
  ) {
    return this.contentService.updateAddon(id, dto);
  }

  @Delete('admin/addons/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete addon (admin)' })
  async deleteAddon(@Param('id', ParseUUIDPipe) id: string) {
    await this.contentService.deleteAddon(id);
    return { success: true };
  }

  @Post('seed-sample-data')
  @ApiOperation({ summary: 'Seed sample data (for testing)' })
  @ApiResponse({ status: 200, description: 'Sample data seeded successfully' })
  async seedSampleData() {
    // This is a simple endpoint to manually trigger sample data seeding
    return { message: 'Sample data seeding triggered. Check logs for details.' };
  }
}
