import { Body, Controller, Get, Param, ParseUUIDPipe, ParseIntPipe, Post, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateEventRequestDto } from './dto/create-event-request.dto';
import { QuoteEventRequestDto } from './dto/quote-event-request.dto';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Create event request' })
  createRequest(@CurrentUser() user: any, @Body() dto: CreateEventRequestDto) {
    return this.eventsService.createRequest(user.id, dto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get user event requests' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Event requests retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserRequests(
    @CurrentUser() user: any,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.eventsService.findUserRequests(user.id, page, limit, { status, type });
  }

  // Admin: list all event requests with basic stats
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all event requests (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async adminListAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 100,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.eventsService.findAllRequests(page, limit, { status, type, branchId, from, to });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get event request' })
  getRequest(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getRequest(user, id);
  }

  // Admin: get event request by ID
  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Get event request by ID (Admin only)' })
  adminGetRequest(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getRequest(user, id);
  }

  @Post('requests/:id/quote')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Quote event request' })
  quote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: QuoteEventRequestDto) {
    return this.eventsService.quote(id, dto);
  }

  @Post('requests/:id/confirm')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Confirm event after payment' })
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.confirm(id);
  }

  @Get('requests/:id/tickets')
  @ApiOperation({ summary: 'Get tickets for event request' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Event request not found' })
  async getEventTickets(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.getEventTickets(id, user);
  }
}


