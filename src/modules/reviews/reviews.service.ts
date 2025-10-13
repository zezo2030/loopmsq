import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../../database/entities/review.entity';
import { Booking, BookingStatus } from '../../database/entities/booking.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviewRepo: Repository<Review>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
  ) {}

  async create(userId: string, dto: { bookingId: string; rating: number; comment?: string }) {
    if (!dto.rating || dto.rating < 1 || dto.rating > 5) throw new BadRequestException('Rating must be 1-5');
    const booking = await this.bookingRepo.findOne({ where: { id: dto.bookingId, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    // ensure booking ended
    const endTime = new Date(booking.startTime.getTime() + booking.durationHours * 60 * 60 * 1000);
    if (Date.now() < endTime.getTime()) throw new BadRequestException('Cannot review before booking end');
    const exists = await this.reviewRepo.findOne({ where: { bookingId: booking.id } });
    if (exists) throw new BadRequestException('Review already submitted');
    const review = this.reviewRepo.create({ bookingId: booking.id, userId, rating: dto.rating, comment: dto.comment || null });
    return this.reviewRepo.save(review);
  }

  async get(userId: string, bookingId: string) {
    const booking = await this.bookingRepo.findOne({ where: { id: bookingId, userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    const review = await this.reviewRepo.findOne({ where: { bookingId } });
    return review || null;
  }
}


