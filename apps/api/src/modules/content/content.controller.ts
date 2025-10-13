import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ContentService } from './content.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateHallDto } from './dto/create-hall.dto';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

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
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Branches retrieved successfully' })
  async findAllBranches(
    @Query('includeInactive', new ParseBoolPipe({ optional: true }))
    includeInactive: boolean = false,
  ) {
    return this.contentService.findAllBranches(includeInactive);
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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update branch (Admin only)' })
  @ApiResponse({ status: 200, description: 'Branch updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async updateBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateBranchDto>,
  ) {
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

  // Hall endpoints
  @Post('halls')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create new hall (Admin only)' })
  @ApiResponse({ status: 201, description: 'Hall created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Branch not found' })
  async createHall(@Body() createHallDto: CreateHallDto) {
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
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update hall (Admin only)' })
  @ApiResponse({ status: 200, description: 'Hall updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Hall not found' })
  async updateHall(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: Partial<CreateHallDto>,
  ) {
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
    const startDate = new Date(startTime);
    const isAvailable = await this.contentService.checkHallAvailability(
      id,
      startDate,
      durationHours,
    );

    return { available: isAvailable };
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
}
