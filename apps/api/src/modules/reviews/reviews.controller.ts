import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: any, @Body() body: { bookingId: string; rating: number; comment?: string }) {
    return this.reviews.create(user.id, body);
  }

  @Get(':bookingId')
  async get(@CurrentUser() user: any, @Param('bookingId') bookingId: string) {
    return this.reviews.get(user.id, bookingId);
  }
}


