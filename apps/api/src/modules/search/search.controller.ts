import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';

@ApiTags('search')
@Controller('search')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('users')
  users(@Query('q') q: string, @Query('page') page = '1', @Query('limit') limit = '10') {
    return this.search.searchUsers(q || '', Number(page), Number(limit));
  }

  @Get('bookings')
  bookings(
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('branchId') branchId?: string,
  ) {
    return this.search.searchBookings(q || '', Number(page), Number(limit), branchId);
  }

  @Get('payments')
  payments(
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.search.searchPayments(q || '', Number(page), Number(limit));
  }
}


