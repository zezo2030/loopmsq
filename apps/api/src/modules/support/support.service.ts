import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket, TicketPriority, TicketStatus } from '../../database/entities/support-ticket.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, input: { subject: string; description: string; category: string; priority?: TicketPriority }) {
    if (!input.subject || !input.description) throw new BadRequestException('Subject and description are required');
    const ticket = this.ticketRepo.create({
      userId,
      subject: input.subject,
      description: input.description,
      category: input.category as any,
      priority: input.priority || TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      messages: [],
      lastMessageAt: new Date(),
    });
    const saved = await this.ticketRepo.save(ticket);
    await this.notifications.enqueue({ type: 'ADMIN_MESSAGE', to: { userId }, data: { message: `تم فتح تذكرة دعم: ${saved.subject}` }, channels: ['sms', 'push'] });
    return saved;
  }

  async get(user: any, id: string) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('support.ticket_not_found');
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isStaff && ticket.userId !== user.id) throw new ForbiddenException('errors.not_allowed');
    return ticket;
  }

  async reply(user: any, id: string, message: string, attachments?: string[]) {
    if (!message) throw new BadRequestException('Message required');
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    const senderType = isStaff ? 'staff' : 'user';
    if (!isStaff && ticket.userId !== user.id) throw new ForbiddenException('Not allowed');
    ticket.messages = [...(ticket.messages || []), { id: uuidv4(), senderId: user.id, senderType, message, timestamp: new Date(), attachments }];
    ticket.lastMessageAt = new Date();
    await this.ticketRepo.save(ticket);
    // notify counterpart
    const targetUserId = isStaff ? ticket.userId : ticket.assignedTo;
    if (targetUserId) {
      await this.notifications.enqueue({ type: 'ADMIN_MESSAGE', to: { userId: targetUserId }, data: { message: `رسالة جديدة على تذكرة: ${ticket.subject}` }, channels: ['sms', 'push'] });
    }
    return { success: true };
  }

  async updateStatus(staff: any, id: string, changes: { status?: TicketStatus; priority?: TicketPriority; assignTo?: string }) {
    const roles: string[] = staff.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isStaff) throw new ForbiddenException('Not allowed');
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (changes.status) {
      ticket.status = changes.status;
      if (changes.status === TicketStatus.RESOLVED) ticket.resolvedAt = new Date();
      if (changes.status === TicketStatus.CLOSED) ticket.closedAt = new Date();
    }
    if (changes.priority) ticket.priority = changes.priority;
    if (changes.assignTo) ticket.assignedTo = changes.assignTo;
    await this.ticketRepo.save(ticket);
    await this.notifications.enqueue({ type: 'ADMIN_MESSAGE', to: { userId: ticket.userId }, data: { message: `تم تحديث حالة التذكرة: ${ticket.status}` }, channels: ['sms', 'push'] });
    return { success: true };
  }

  async list(user: any, page = 1, limit = 10) {
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    const [items, total] = await this.ticketRepo.findAndCount({
      where: isStaff ? {} : { userId: user.id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    } as any);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }
}


