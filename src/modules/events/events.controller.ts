import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

  @Get('requests/:id')
  @ApiOperation({ summary: 'Get event request' })
  getRequest(@CurrentUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
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
}


