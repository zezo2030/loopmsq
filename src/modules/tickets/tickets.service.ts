import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../../database/entities/ticket.entity';
import { Booking } from '../../database/entities/booking.entity';
import { QRCodeService } from '../../utils/qr-code.service';
import { RedisService } from '../../utils/redis.service';
import { GiftTicketDto } from './dto/gift-ticket.dto';
import { ShareTicketDto } from './dto/share-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    private readonly qrCodeService: QRCodeService,
    private readonly redisService: RedisService,
  ) {}

  private async ensureOwner(userId: string, ticketId: string): Promise<{ ticket: Ticket; booking: Booking }> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId }, relations: ['booking'] });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const booking = await this.bookingRepo.findOne({ where: { id: ticket.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.userId !== userId) throw new ForbiddenException('Not allowed');
    return { ticket, booking };
  }

  async getTicketQR(userId: string, ticketId: string) {
    const { ticket, booking } = await this.ensureOwner(userId, ticketId);
    const token = this.qrCodeService.generateQRToken(booking.id, ticket.id);
    // Store ephemeral mapping for 5 minutes
    const redis = this.redisService.getClient();
    await redis.setex(`share:qr:${token}`, 300, ticket.qrTokenHash);
    const qrDataUrl = await this.qrCodeService.generateQRCode(token);
    return { qr: qrDataUrl, ttlSeconds: 300 };
  }

  async getShareLink(userId: string, ticketId: string) {
    const { ticket, booking } = await this.ensureOwner(userId, ticketId);
    const token = this.qrCodeService.generateQRToken(booking.id, ticket.id);
    const redis = this.redisService.getClient();
    await redis.setex(`share:link:${token}`, 3600, ticket.id);
    return { token, ttlSeconds: 3600 };
  }

  async createShareToken(userId: string, ticketId: string, dto: ShareTicketDto) {
    const { ticket, booking } = await this.ensureOwner(userId, ticketId);
    const ttl = Math.max(60, Math.min(86400, dto.ttlSeconds || 900));
    const token = this.qrCodeService.generateQRToken(booking.id, ticket.id);
    const redis = this.redisService.getClient();
    await redis.setex(`share:link:${token}`, ttl, ticket.id);
    return { token, ttlSeconds: ttl };
  }

  async giftTicket(userId: string, ticketId: string, dto: GiftTicketDto) {
    const { ticket } = await this.ensureOwner(userId, ticketId);
    ticket.holderName = dto.holderName;
    ticket.holderPhone = dto.holderPhone;
    await this.ticketRepo.save(ticket);
    return { success: true };
  }
}


