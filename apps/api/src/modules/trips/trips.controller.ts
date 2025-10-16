import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  ParseIntPipe,
  Post,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { InvoiceTripRequestDto } from './dto/invoice-trip-request.dto';
import { IssueTicketsDto } from './dto/issue-tickets.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { TripsService } from './trips.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateTripRequestDto } from './dto/create-trip-request.dto';
import { SubmitTripRequestDto } from './dto/submit-trip-request.dto';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('requests')
  @ApiOperation({ summary: 'Create school trip request (user)' })
  @ApiResponse({ status: 201, description: 'Request created' })
  createRequest(
    @CurrentUser() user: any,
    @Body() dto: CreateTripRequestDto,
  ) {
    return this.tripsService.createRequest(user.id, dto);
  }

  // Admin: list all trip requests with basic stats
  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all school trip requests (Admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async adminListAll(
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 100,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.tripsService.findAllRequests(page, limit, { status, from, to });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get trip request (owner or admin/staff)' })
  getRequest(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.getRequest(user, id);
  }

  @Post('requests/:id/submit')
  @ApiOperation({ summary: 'Submit trip request (user)' })
  submitRequest(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitTripRequestDto,
  ) {
    return this.tripsService.submitRequest(user.id, id, dto);
  }

  @Post('requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Approve trip request (Admin/Staff)' })
  approveRequest(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tripsService.approveRequest(user.id, id);
  }

  @Post('requests/:id/upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.USER)
  @ApiOperation({ summary: 'Upload Excel of participants' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
    }),
  )
  uploadParticipants(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tripsService.uploadParticipants(user.id, id, file);
  }

  @Post('requests/:id/invoice')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Create invoice for approved request' })
  createInvoice(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvoiceTripRequestDto,
  ) {
    return this.tripsService.createInvoice(user.id, id, dto);
  }

  @Post('requests/:id/issue-tickets')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Issue tickets after payment' })
  issueTickets(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IssueTicketsDto,
  ) {
    return this.tripsService.issueTickets(user.id, id, dto);
  }

  @Post('requests/:id/mark-paid')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Mark a trip request as paid (manual/cash)' })
  markPaid(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.tripsService.markPaid(user.id, id, dto);
  }
}


