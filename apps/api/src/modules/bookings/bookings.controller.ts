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
    return this.bookingsService.getQuote(quoteDto);
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
    return this.bookingsService.createBooking(user.id, createBookingDto);
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
  @ApiQuery({ name: 'hallId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'ISO date - startTime from' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'ISO date - startTime to' })
  async adminListAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 100,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('hallId') hallId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.bookingsService.findAllBookings(page, limit, { status, branchId, hallId, from, to });
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
    return this.bookingsService.findBranchBookings(user.branchId!, page, limit, from, to, status);
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
  @ApiResponse({ status: 200, description: 'Pricing details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingPricing(@Param('id', ParseUUIDPipe) id: string) {
    return this.bookingsService.getBookingPricing(id);
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
    @Body('reason') reason?: string,
  ) {
    const isManager = user.roles?.includes(UserRole.BRANCH_MANAGER) || false;
    return this.bookingsService.cancelBooking(id, user.id, reason, user.branchId, isManager);
  }

  // Staff endpoints
  @Post('staff/scan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Scan ticket QR code (Staff only)' })
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
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Get ticket details by QR token (Staff only)' })
  @ApiResponse({
    status: 200,
    description: 'Ticket details retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getTicketByToken(@Param('token') token: string) {
    return this.bookingsService.getTicketByToken(token);
  }

  @Get('staff/scans/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'List tickets scanned by current staff' })
  async getMyScans(@CurrentUser() user: User) {
    return this.bookingsService.getStaffScans(user.id);
  }

  @Get('staff/scans/me/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF)
  @ApiOperation({ summary: 'Get scan statistics for current staff (today, week, month, total)' })
  @ApiResponse({ status: 200, description: 'Scan statistics retrieved successfully' })
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
}
