import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles, UserRole } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@ApiTags('search')
@Controller('search')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
@ApiBearerAuth()
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('users')
  users(
    @CurrentUser() user: User,
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.search.searchUsers(q || '', Number(page), Number(limit), user);
  }

  @Get('bookings')
  bookings(
    @CurrentUser() user: User,
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('branchId') branchId?: string,
  ) {
    const effectiveBranchId = user.roles?.includes(UserRole.BRANCH_MANAGER) ? (user.branchId || undefined) : branchId;
    return this.search.searchBookings(q || '', Number(page), Number(limit), effectiveBranchId, user);
  }

  @Get('payments')
  payments(
    @CurrentUser() user: User,
    @Query('q') q: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.search.searchPayments(q || '', Number(page), Number(limit), user);
  }
}


