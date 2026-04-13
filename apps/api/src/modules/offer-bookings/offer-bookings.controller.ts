import {
  Controller,
  Get,
  Post,
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
import { OfferBookingsService } from './offer-bookings.service';
import { OfferQuoteDto } from './dto/offer-quote.dto';
import { CreateOfferBookingDto } from './dto/create-offer-booking.dto';
import { ScanOfferTicketDto } from './dto/scan-offer-ticket.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { User } from '../../database/entities/user.entity';

@ApiTags('offer-bookings')
@Controller('offer-bookings')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class OfferBookingsController {
  constructor(private readonly service: OfferBookingsService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Get offer purchase quote' })
  @ApiResponse({ status: 200, description: 'Quote calculated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Offer inactive or outside availability window',
  })
  @ApiResponse({ status: 409, description: 'Cannot repeat this offer' })
  async getQuote(@CurrentUser() user: User, @Body() dto: OfferQuoteDto) {
    return this.service.getQuote(user.id, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create offer booking and initiate payment' })
  @ApiResponse({ status: 201, description: 'Booking created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Offer inactive or outside availability window',
  })
  @ApiResponse({ status: 409, description: 'Cannot repeat this offer' })
  async createBooking(
    @CurrentUser() user: User,
    @Body() dto: CreateOfferBookingDto,
  ) {
    return this.service.createBooking(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user offer bookings' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Bookings retrieved successfully' })
  async getUserBookings(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 10,
  ) {
    return this.service.findUserBookings(user.id, page, limit);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all offer bookings (admin)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiQuery({ name: 'branchId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAdminOfferBookings(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('branchId') branchId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAdminBookings(page, limit, {
      status: status as any,
      paymentStatus: paymentStatus as any,
      branchId,
      from,
      to,
      search,
    });
  }

  @Get('branch/me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get branch offer bookings (branch manager)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'paymentStatus', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getBranchOfferBookings(
    @CurrentUser() user: User,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
    @Query('status') status?: string,
    @Query('paymentStatus') paymentStatus?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findBranchBookings(user.branchId!, page, limit, {
      status: status as any,
      paymentStatus: paymentStatus as any,
      from,
      to,
      search,
    });
  }

  @Get('admin/all/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get offer booking details (admin)' })
  async getAdminOfferBookingById(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findBookingForAdmin(id);
  }

  @Get('branch/me/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get offer booking details (branch manager)' })
  async getBranchOfferBookingById(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findBookingForBranch(id, user.branchId!);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer booking details' })
  @ApiResponse({ status: 200, description: 'Booking retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBooking(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findBookingById(id, user.id);
  }

  @Get(':id/tickets')
  @ApiOperation({ summary: 'Get all tickets for an offer booking' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getBookingTickets(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findBookingTickets(id, user.id);
  }

  @Get('staff/offer-tickets/token/:token')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get offer ticket preview by token (staff)' })
  @ApiResponse({ status: 200, description: 'Ticket preview retrieved' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async getStaffTicketPreview(
    @CurrentUser() user: User,
    @Param('token') token: string,
  ) {
    const ticket = await this.service.findTicketByTokenForStaff(
      token,
      user.id,
    );
    const booking = await this.service.findBookingById(
      ticket.offerBookingId,
      ticket.userId,
    );
    const offer = await this.service.findOfferById(ticket.offerProductId);
    return {
      ticket: {
        id: ticket.id,
        ticketKind: ticket.ticketKind,
        status: ticket.status,
        scannedAt: ticket.scannedAt,
        startedAt: ticket.startedAt,
        expiresAt: ticket.expiresAt,
      },
      booking: {
        id: booking.id,
        totalPrice: booking.totalPrice,
        selectedAddOns: booking.selectedAddOns,
        contactPhone: booking.contactPhone,
        createdAt: booking.createdAt,
      },
      offer: {
        title: offer.title,
        offerCategory: offer.offerCategory,
        imageUrl: offer.imageUrl,
        includedAddOns: offer.includedAddOns,
      },
      user: {
        id: ticket.userId,
        name: ticket.user?.name || 'User',
        phone: ticket.user?.phone || '',
      },
      branch: {
        id: ticket.branchId,
        name: ticket.branch?.name_ar || ticket.branch?.name_en || 'Branch',
      },
    };
  }

  @Post('staff/offer-tickets/scan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.STAFF, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Confirm offer ticket scan (staff)' })
  @ApiResponse({ status: 200, description: 'Ticket scanned successfully' })
  @ApiResponse({ status: 400, description: 'Ticket already used or expired' })
  async scanTicket(@CurrentUser() user: User, @Body() dto: ScanOfferTicketDto) {
    return this.service.scanTicket(dto.token, user.id);
  }
}
