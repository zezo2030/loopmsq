import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment } from '../../database/entities/payment.entity';
import { Booking } from '../../database/entities/booking.entity';
import { OfferBooking } from '../../database/entities/offer-booking.entity';
import { SubscriptionPurchase } from '../../database/entities/subscription-purchase.entity';
import { User } from '../../database/entities/user.entity';
import { EInvoiceType } from '../../database/entities/einvoice.entity';
import { getZatcaConfig, ZatcaConfig } from '../../config/zatca.config';
import {
  CustomerInput,
  InvoiceLineInput,
} from '../../integrations/zatca/zatca.types';

export interface ComposedInvoice {
  type: EInvoiceType;
  lines: InvoiceLineInput[];
  customer?: CustomerInput;
}

/**
 * Turns a completed Payment into invoice lines + buyer details.
 *
 * - Itemizes from the linked aggregate (booking add-ons, offer product +
 *   add-ons, subscription plan) when the parts reconcile to the paid amount;
 *   otherwise falls back to a single reconciled line so ZATCA total checks
 *   (BR-CO-*) can never fail.
 * - Resolves the buyer from the aggregate's user and, when they have a tax
 *   `billingProfile.vatNumber`, marks the invoice STANDARD (B2B) with full
 *   buyer party details; otherwise SIMPLIFIED (B2C).
 */
@Injectable()
export class InvoiceCompositionService {
  private readonly logger = new Logger(InvoiceCompositionService.name);
  private readonly cfg: ZatcaConfig;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(OfferBooking)
    private readonly offerBookingRepo: Repository<OfferBooking>,
    @InjectRepository(SubscriptionPurchase)
    private readonly subscriptionRepo: Repository<SubscriptionPurchase>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    configService: ConfigService,
  ) {
    this.cfg = getZatcaConfig(configService);
  }

  async compose(payment: Payment): Promise<ComposedInvoice> {
    const rate = this.cfg.defaultVatRate;
    const amount = Number(payment.amount) || 0;

    const { lines: rawLines, userId } = await this.itemize(payment);

    // Convert inclusive component prices -> net unit prices and validate the
    // reconciliation against the actually-charged amount.
    let lines = rawLines.map((l) => this.toNetLine(l, rate));
    if (!this.reconciles(lines, amount, rate)) {
      this.logger.debug(
        `Itemization for payment ${payment.id} did not reconcile to ${amount}; using single line`,
      );
      lines = [this.singleLine(payment, rate)];
    }

    const customer = userId ? await this.resolveCustomer(userId) : undefined;
    const type =
      customer && customer.vatNumber
        ? EInvoiceType.STANDARD
        : EInvoiceType.SIMPLIFIED;

    return { type, lines, customer };
  }

  // ---- itemization per aggregate (prices are VAT-inclusive) ----

  private async itemize(
    payment: Payment,
  ): Promise<{ lines: InclusiveLine[]; userId?: string }> {
    if (payment.bookingId) {
      const b = await this.bookingRepo.findOne({
        where: { id: payment.bookingId },
      });
      if (b) return { lines: this.bookingLines(b), userId: b.userId };
    }
    if (payment.offerBookingId) {
      const o = await this.offerBookingRepo.findOne({
        where: { id: payment.offerBookingId },
      });
      if (o) return { lines: this.offerLines(o), userId: o.userId };
    }
    if (payment.subscriptionPurchaseId) {
      const s = await this.subscriptionRepo.findOne({
        where: { id: payment.subscriptionPurchaseId },
      });
      if (s)
        return {
          lines: [
            {
              name:
                (s.planSnapshot && (s.planSnapshot.name || s.planSnapshot.title)) ||
                'Subscription',
              quantity: 1,
              inclusiveUnitPrice: Number(payment.amount) || 0,
            },
          ],
          userId: s.userId,
        };
    }
    // trip / event / gift / unknown -> single line (no user lookup)
    return { lines: [this.inclusiveSingle(payment)] };
  }

  private bookingLines(b: Booking): InclusiveLine[] {
    const lines: InclusiveLine[] = [];
    const addons = Array.isArray(b.addOns) ? b.addOns : [];
    const addonsSum = addons.reduce(
      (s, a) => s + Number(a.price || 0) * Number(a.quantity || 1),
      0,
    );
    const base = round2(Number(b.totalPrice || 0) - addonsSum);
    if (base > 0) {
      lines.push({
        name: `Booking (${b.persons} pax × ${b.durationHours}h)`,
        quantity: 1,
        inclusiveUnitPrice: base,
      });
    }
    for (const a of addons) {
      lines.push({
        name: a.name || 'Add-on',
        quantity: Number(a.quantity || 1),
        inclusiveUnitPrice: Number(a.price || 0),
      });
    }
    return lines.length ? lines : [];
  }

  private offerLines(o: OfferBooking): InclusiveLine[] {
    const lines: InclusiveLine[] = [];
    const qty = Number(o.quantity || 1);
    const subtotal = Number(o.subtotal || 0);
    const productName =
      (o.offerSnapshot &&
        (o.offerSnapshot.title ||
          o.offerSnapshot.name ||
          o.offerSnapshot.productName)) ||
      'Offer product';
    if (subtotal > 0) {
      lines.push({
        name: productName,
        quantity: qty,
        inclusiveUnitPrice: round2(subtotal / Math.max(qty, 1)),
      });
    }
    const addonsTotal = Number(o.addonsTotal || 0);
    if (addonsTotal > 0) {
      lines.push({
        name: 'Add-ons',
        quantity: 1,
        inclusiveUnitPrice: addonsTotal,
      });
    }
    return lines;
  }

  private inclusiveSingle(payment: Payment): InclusiveLine {
    return {
      name: this.describePayment(payment),
      quantity: 1,
      inclusiveUnitPrice: Number(payment.amount) || 0,
    };
  }

  // ---- helpers ----

  private toNetLine(l: InclusiveLine, rate: number): InvoiceLineInput {
    const unitPrice = this.cfg.amountIncludesVat
      ? round2(l.inclusiveUnitPrice / (1 + rate / 100))
      : round2(l.inclusiveUnitPrice);
    return {
      name: l.name,
      quantity: l.quantity,
      unitPrice,
      vatRate: rate,
      vatCategory: 'S',
    };
  }

  private singleLine(payment: Payment, rate: number): InvoiceLineInput {
    return this.toNetLine(this.inclusiveSingle(payment), rate);
  }

  /** Does the sum of line inclusive totals match the charged amount (±0.02)? */
  private reconciles(
    lines: InvoiceLineInput[],
    amount: number,
    rate: number,
  ): boolean {
    if (!lines.length) return false;
    const sumIncl = lines.reduce((s, l) => {
      const net = round2(l.quantity * l.unitPrice);
      const vat = round2((net * rate) / 100);
      return round2(s + net + vat);
    }, 0);
    return Math.abs(sumIncl - amount) <= 0.02;
  }

  private async resolveCustomer(
    userId: string,
  ): Promise<CustomerInput | undefined> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return undefined;
    const bp = user.billingProfile;
    if (!bp || !bp.vatNumber) {
      // B2C: pass the name only (optional for simplified invoices).
      return user.name ? { name: user.name } : undefined;
    }
    return {
      name: bp.companyName || user.name,
      vatNumber: bp.vatNumber,
      identityScheme: bp.idScheme,
      identityValue: bp.idValue,
      street: bp.street,
      buildingNumber: bp.buildingNumber,
      plotIdentification: bp.plotIdentification,
      citySubdivision: bp.citySubdivision,
      city: bp.city,
      postalZone: bp.postalZone,
      countrySubentity: bp.countrySubentity,
      countryCode: bp.countryCode || 'SA',
    };
  }

  private describePayment(payment: Payment): string {
    if (payment.bookingId) return `Booking #${payment.bookingId.slice(0, 8)}`;
    if (payment.tripRequestId) return `Trip #${payment.tripRequestId.slice(0, 8)}`;
    if (payment.offerBookingId)
      return `Offer booking #${payment.offerBookingId.slice(0, 8)}`;
    if (payment.subscriptionPurchaseId)
      return `Subscription #${payment.subscriptionPurchaseId.slice(0, 8)}`;
    if (payment.eventRequestId)
      return `Event #${payment.eventRequestId.slice(0, 8)}`;
    if (payment.giftOrderId)
      return `Gift order #${payment.giftOrderId.slice(0, 8)}`;
    return `Payment #${payment.id.slice(0, 8)}`;
  }
}

interface InclusiveLine {
  name: string;
  quantity: number;
  inclusiveUnitPrice: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
