import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQuoteDto } from './dto/booking-quote.dto';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { CreateFreeTicketDto } from './dto/create-free-ticket.dto';
import { CreateFreeTicketAdminDto } from './dto/create-free-ticket-admin.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../database/entities/user.entity';

@ApiTags('bookings')
@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Get booking quote and pricing' })
  @ApiResponse({ status: 200, description: 'Quote calculated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Hall not available' })
  async getQuote(@Body() quoteDto: BookingQuoteDto) {
    void quoteDto;
    throw new GoneException(
      'Direct booking quote has been removed. Use branch offers instead.',
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create new booking' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Hall not available' })
  async createBooking(
    @CurrentUser() user: User,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    void user;
    void createBookingDto;
    throw new GoneException(
      'Direct booking creation has been removed. Use branch offers instead.',
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get user bookings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserBookings(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.bookingsService.findUserBookings(user.id, page, limit);
  }

  // Admin: list all bookings
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all bookings (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'ISO date - startTime from',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'ISO date - startTime to',
  })
  async adminListAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 100,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.findAllBookings(page, limit, {
      status,
      branchId,
      from,
      to,
    });
  }

  // Branch manager: list branch bookings
  @Get('branch/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get branch bookings (Branch Manager only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getBranchBookings(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.bookingsService.findBranchBookings(
      user.branchId!,
      page,
      limit,
      from,
      to,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking by ID' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBooking(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const roles = user.roles || [];
    const isAdmin = roles.includes(UserRole.ADMIN);
    const isManager = roles.includes(UserRole.BRANCH_MANAGER);
    return this.bookingsService.findBookingById(
      id,
      isAdmin ? undefined : user.id,
      user.branchId,
      isAdmin || isManager,
    );
  }

  @Get(':id/tickets')
  @ApiOperation({ summary: 'Get booking tickets' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingTickets(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const roles = user.roles || [];
    const isAdmin = roles.includes(UserRole.ADMIN);
    const isManager = roles.includes(UserRole.BRANCH_MANAGER);
    return this.bookingsService.getBookingTickets(
      id,
      isAdmin ? undefined : user.id,
      user.branchId,
      isAdmin || isManager,
    );
  }

  @Get(':id/pricing')
  @ApiOperation({ summary: 'Get detailed pricing for existing booking' })
  @ApiResponse({
    status: 200,
    description: 'Pricing details retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingPricing(@Param('id', ParseUUIDPipe) id: string) {
    void id;
    throw new GoneException(
      'Booking pricing has been removed. Use offer pricing instead.',
    );
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel booking' })
  @ApiResponse({ status: 200, description: 'Booking cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot cancel booking' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async cancelBooking(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelBookingDto,
  ) {
    const isManagerOrAdmin =
      user.roles?.includes(UserRole.BRANCH_MANAGER) ||
      user.roles?.includes(UserRole.ADMIN) ||
      false;
    return this.bookingsService.cancelBooking(
      id,
      user.id,
      body.reason,
      user.branchId,
      isManagerOrAdmin,
    );
  }

  // Staff endpoints (branch managers may use the same staff app to scan)
  @Post('staff/scan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Scan ticket QR code (Staff or Branch Manager)' })
  @ApiResponse({ status: 200, description: 'Ticket scanned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid QR code' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async scanTicket(
    @CurrentUser() user: User,
    @Body() scanTicketDto: ScanTicketDto,
  ) {
    return this.bookingsService.scanTicket(user.id, scanTicketDto);
  }

  @Get('staff/ticket/:token')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Get ticket details by QR token (Staff or Branch Manager)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ticket details retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketByToken(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    return this.bookingsService.getTicketByToken(user.id, token);
  }

  @Get('staff/scans/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'List tickets scanned by current staff or branch manager',
  })
  async getMyScans(@CurrentUser() user: User) {
    return this.bookingsService.getStaffScans(user.id);
  }

  @Get('staff/scans/me/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Get scan statistics for current user (today, week, month, total)',
  })
  @ApiResponse({
    status: 200,
    description: 'Scan statistics retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getMyScanStats(@CurrentUser() user: User) {
    return this.bookingsService.getStaffScanStats(user.id);
  }

  // Hard delete booking (Admin/Branch Manager)
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Hard delete a booking (Admin/Branch Manager)' })
  @ApiResponse({ status: 200, description: 'Booking deleted permanently' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async hardDelete(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const roles = user.roles || [];
    const isAdmin = roles.includes(UserRole.ADMIN);
    const isManager = roles.includes(UserRole.BRANCH_MANAGER);
    return this.bookingsService.deleteBookingHard(
      id,
      isAdmin ? undefined : user.id,
      user.branchId,
      isAdmin || isManager,
    );
  }

  // Create free ticket (Branch Manager only)
  @Post('free-ticket')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Create free ticket for user (Branch Manager only)',
  })
  @ApiResponse({ status: 201, description: 'Free ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User or hall not found' })
  async createFreeTicket(
    @CurrentUser() user: User,
    @Body() dto: CreateFreeTicketDto,
  ) {
    if (!user.branchId) {
      throw new BadRequestException(
        'Branch manager must have a branch assigned',
      );
    }
    return this.bookingsService.createFreeTicket(user.id, user.branchId, dto);
  }

  // Create free ticket (Admin only - can create for any branch)
  @Post('admin/free-ticket')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Create free ticket for user (Admin only - can create for any branch)',
  })
  @ApiResponse({ status: 201, description: 'Free ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User, branch or hall not found' })
  async createFreeTicketAdmin(
    @CurrentUser() user: User,
    @Body() dto: CreateFreeTicketAdminDto,
  ) {
    return this.bookingsService.createFreeTicketForAdmin(user.id, dto);
  }
}
