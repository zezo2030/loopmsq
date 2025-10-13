import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolTripRequest, TripRequestStatus } from '../../database/entities/school-trip-request.entity';
import * as XLSX from 'xlsx';
import { InvoiceTripRequestDto } from './dto/invoice-trip-request.dto';
import { IssueTicketsDto } from './dto/issue-tickets.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { CreateTripRequestDto } from './dto/create-trip-request.dto';
import { SubmitTripRequestDto } from './dto/submit-trip-request.dto';

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(SchoolTripRequest)
    private readonly tripRepo: Repository<SchoolTripRequest>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {}

  async createRequest(userId: string, dto: CreateTripRequestDto) {
    const req = this.tripRepo.create({
      requesterId: userId,
      schoolName: dto.schoolName,
      studentsCount: dto.studentsCount,
      accompanyingAdults: dto.accompanyingAdults,
      preferredDate: dto.preferredDate,
      preferredTime: dto.preferredTime,
      durationHours: dto.durationHours ?? 2,
      contactPersonName: dto.contactPersonName,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      specialRequirements: dto.specialRequirements,
      status: TripRequestStatus.PENDING,
    });
    const saved = await this.tripRepo.save(req);
    return { id: saved.id };
  }

  async getRequest(user: any, id: string) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    const isOwner = req.requesterId === user.id;
    const roles: string[] = user.roles || [];
    const isStaff = roles.includes('staff') || roles.includes('admin');
    if (!isOwner && !isStaff) throw new ForbiddenException('Not allowed');
    return req;
  }

  async submitRequest(userId: string, id: string, dto: SubmitTripRequestDto) {
    const req = await this.tripRepo.findOne({ where: { id, requesterId: userId } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be submitted');
    }
    req.status = TripRequestStatus.UNDER_REVIEW;
    await this.tripRepo.save(req);
    return { success: true };
  }

  async approveRequest(approverId: string, id: string) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.UNDER_REVIEW) {
      throw new BadRequestException('Only under_review requests can be approved');
    }
    req.status = TripRequestStatus.APPROVED;
    req.approvedAt = new Date();
    req.approvedBy = approverId;
    await this.tripRepo.save(req);
    return { success: true };
  }

  async uploadParticipants(userId: string, id: string, file: Express.Multer.File) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.requesterId !== userId && req.status !== TripRequestStatus.UNDER_REVIEW) {
      throw new ForbiddenException('Not allowed');
    }
    if (!file) throw new BadRequestException('File is required');
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: '',
      raw: false,
      blankrows: false,
    });
    const participants = rows.map((r, idx) => {
      if (!r.name || !r.guardianPhone) {
        throw new BadRequestException(`Invalid row ${idx + 2}: name and guardianPhone are required`);
      }
      return {
        name: String(r.name).trim(),
        age: Number(r.age || 0),
        guardianName: String(r.guardianName || '').trim(),
        guardianPhone: String(r.guardianPhone).trim(),
      };
    });
    req.studentsList = participants;
    req.excelFilePath = file.path;
    await this.tripRepo.save(req);
    return { count: participants.length };
  }

  async createInvoice(approverId: string, id: string, dto: InvoiceTripRequestDto) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.APPROVED) {
      throw new BadRequestException('Only approved requests can be invoiced');
    }
    const baseCount = (req.studentsList?.length || req.studentsCount) + (req.accompanyingAdults || 0);
    const pricePerPerson = 50; // SAR mock pricing
    const total = dto.overrideAmount ?? baseCount * pricePerPerson;
    req.quotedPrice = total;
    req.status = TripRequestStatus.INVOICED;
    req.invoiceId = `inv_${req.id}`;
    await this.tripRepo.save(req);
    return { invoiceId: req.invoiceId, amount: total, currency: dto.currency || 'SAR' };
  }

  async issueTickets(issuerId: string, id: string, dto: IssueTicketsDto) {
    const req = await this.tripRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== TripRequestStatus.PAID && req.status !== TripRequestStatus.INVOICED) {
      throw new BadRequestException('Tickets can be issued only after payment');
    }
    // Create a booking representing the trip
    const persons = (req.studentsList?.length || req.studentsCount) + (req.accompanyingAdults || 0);
    const booking = this.bookingRepo.create({
      userId: req.requesterId,
      branchId: '00000000-0000-0000-0000-000000000000',
      hallId: null,
      startTime: new Date(dto.startTime),
      durationHours: dto.durationHours,
      persons,
      totalPrice: req.quotedPrice || persons * 50,
      status: 1 as any, // will be set by BookingsService when paid normally; here just placeholder
    });
    await this.bookingRepo.save(booking);
    req.status = TripRequestStatus.COMPLETED;
    await this.tripRepo.save(req);
    return { bookingId: booking.id };
  }
}


