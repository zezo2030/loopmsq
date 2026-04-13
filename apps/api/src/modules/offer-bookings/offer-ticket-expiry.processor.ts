import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  OfferTicket,
  OfferTicketStatus,
  OfferTicketKind,
} from '../../database/entities/offer-ticket.entity';

@Processor('offer_ticket_expiry')
export class OfferTicketExpiryProcessor {
  private readonly logger = new Logger(OfferTicketExpiryProcessor.name);

  constructor(
    @InjectRepository(OfferTicket)
    private readonly ticketRepo: Repository<OfferTicket>,
  ) {}

  @Process('expire')
  async handleExpiry(job: Job<{ ticketId: string }>) {
    const { ticketId } = job.data;

    this.logger.log(`Processing expiry check for ticket ${ticketId}`);

    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });

    if (!ticket) {
      this.logger.warn(`Ticket ${ticketId} not found for expiry check`);
      return;
    }

    if (ticket.ticketKind !== OfferTicketKind.TIMED) {
      this.logger.warn(`Ticket ${ticketId} is not a timed ticket — skipping`);
      return;
    }

    if (ticket.status !== OfferTicketStatus.IN_USE) {
      this.logger.log(
        `Ticket ${ticketId} status is ${ticket.status} — skipping expiry`,
      );
      return;
    }

    const now = new Date();

    if (ticket.expiresAt && now >= ticket.expiresAt) {
      ticket.status = OfferTicketStatus.EXPIRED;
      await this.ticketRepo.save(ticket);
      this.logger.log(`Ticket ${ticketId} expired (Bull delayed job)`);
    } else {
      this.logger.log(
        `Ticket ${ticketId} not yet expired — expiresAt: ${ticket.expiresAt}`,
      );
    }
  }
}
