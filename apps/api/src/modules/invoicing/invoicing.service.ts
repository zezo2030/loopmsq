import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  EInvoice,
  EInvoiceDocumentType,
  EInvoiceStatus,
  EInvoiceType,
} from '../../database/entities/einvoice.entity';
import { ZatcaCredential } from '../../database/entities/zatca-credential.entity';
import { Payment, PaymentStatus } from '../../database/entities/payment.entity';
import { EncryptionService } from '../../utils/encryption.util';
import { getZatcaConfig, ZatcaConfig } from '../../config/zatca.config';
import { ZatcaClient } from '../../integrations/zatca/zatca.client';
import { ZatcaXmlService } from '../../integrations/zatca/zatca-xml.service';
import { ZatcaSignerService } from '../../integrations/zatca/zatca-signer.service';
import {
  BuildInvoiceInput,
  InvoiceDocumentType,
  InvoiceTransactionType,
} from '../../integrations/zatca/zatca.types';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { OnboardDto } from './dto/onboard.dto';
import { InvoiceCompositionService } from './invoice-composition.service';

/**
 * Canonical first PIH for the very first invoice in the chain.
 * Verified against the SDK v3.0.8: invoice hashes are base64 of the SHA-256
 * digest *bytes* (44 chars), e.g. the `-invoiceRequest` invoiceHash. So the
 * first PIH = base64( SHA-256("0") ) in that same encoding.
 * (The SDK's shipped Data/PIH/pih.txt uses a different/legacy 88-char encoding
 * which is NOT what the chain uses — do not copy it.)
 */
const INITIAL_PIH = 'X+zrZv/IbzjZUnhsbWlsecLbwjndTpG0ZynXOif7V+k=';

/** Purchase types the customer app can request an e-invoice for. */
export const CUSTOMER_INVOICE_SOURCES = [
  'booking',
  'offer-booking',
  'trip',
  'subscription',
  'gift-order',
  'event',
] as const;
export type CustomerInvoiceSource = (typeof CUSTOMER_INVOICE_SOURCES)[number];

/** Maps each source to the Payment relation and its owner column. */
const SOURCE_OWNERSHIP: Record<
  CustomerInvoiceSource,
  { relation: string; ownerColumn: string }
> = {
  booking: { relation: 'booking', ownerColumn: 'userId' },
  'offer-booking': { relation: 'offerBooking', ownerColumn: 'userId' },
  trip: { relation: 'tripRequest', ownerColumn: 'requesterId' },
  subscription: { relation: 'subscriptionPurchase', ownerColumn: 'userId' },
  'gift-order': { relation: 'giftOrder', ownerColumn: 'senderUserId' },
  event: { relation: 'eventRequest', ownerColumn: 'requesterId' },
};

/** Display-safe e-invoice projection returned to the customer app. */
export interface CustomerInvoiceView {
  id: string;
  invoiceNumber: string;
  uuid: string;
  type: EInvoiceType;
  status: EInvoiceStatus;
  totalExclVat: number;
  totalVat: number;
  totalInclVat: number;
  currency: string;
  qrCode: string | null;
  issuedAt: Date;
}

@Injectable()
export class InvoicingService {
  private readonly logger = new Logger(InvoicingService.name);
  private readonly cfg: ZatcaConfig;
  private readonly client: ZatcaClient;

  constructor(
    @InjectRepository(EInvoice)
    private readonly invoiceRepo: Repository<EInvoice>,
    @InjectRepository(ZatcaCredential)
    private readonly credRepo: Repository<ZatcaCredential>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly encryption: EncryptionService,
    private readonly xml: ZatcaXmlService,
    private readonly signer: ZatcaSignerService,
    private readonly composition: InvoiceCompositionService,
  ) {
    this.cfg = getZatcaConfig(configService);
    this.client = new ZatcaClient(this.cfg.baseUrl, this.cfg.httpTimeoutMs);
  }

  // ===========================================================================
  // Onboarding
  // ===========================================================================

  /**
   * Full onboarding: key+CSR -> compliance CSID -> compliance checks ->
   * production CSID. Idempotent-ish: creates a fresh credential row each call.
   */
  async onboard(dto: OnboardDto): Promise<{ credentialId: string; stage: string }> {
    this.assertSellerConfigured();

    // Fail fast with a clear message if java/openssl/jar aren't ready.
    const tool = await this.signer.checkToolchain();
    if (!tool.ready) {
      throw new BadRequestException(
        `ZATCA toolchain not ready: ${tool.errors.join('; ')}`,
      );
    }

    const otp = dto.otp || this.cfg.onboardingOtp;
    if (!otp) {
      throw new BadRequestException(
        'OTP required. Generate one in the Fatoora portal or set ZATCA_ONBOARDING_OTP.',
      );
    }

    const egsSerial =
      dto.egsSerialNumber ||
      `1-BOOKING|2-NEST|3-${this.cfg.seller.vatNumber}-${Date.now()}`;

    const cred = this.credRepo.create({
      environment: this.cfg.environment,
      egsSerialNumber: egsSerial,
      stage: 'created',
      isActive: false,
    });
    await this.credRepo.save(cred);

    // SDK v3.x CsrGenerationService requires BOTH organization.unit.name and
    // organization.name to be the 10-digit TIN (first 10 digits of the VAT).
    const tin = this.cfg.seller.vatNumber.slice(0, 10);

    try {
      // 1. key + CSR
      const csr = await this.signer.generateKeyAndCsr({
        commonName: egsSerial,
        serialNumber: egsSerial,
        organizationIdentifier: this.cfg.seller.vatNumber,
        organizationUnit: tin,
        organizationName: tin,
        countryName: this.cfg.seller.countryCode,
        invoiceType: '1100', // standard + simplified
        location: `${this.cfg.seller.street}, ${this.cfg.seller.city}`,
        industry: this.cfg.seller.industry,
        environment: this.cfg.environment,
      });
      cred.privateKeyEnc = this.encryption.encrypt(csr.privateKeyPem);
      cred.csrPem = csr.csrPem;
      await this.credRepo.save(cred);

      // 2. compliance CSID (consumes the OTP)
      const compliance = await this.client.requestComplianceCsid(
        csr.csrBase64,
        otp,
      );
      cred.complianceRequestId = compliance.requestId;
      cred.complianceTokenEnc = this.encryption.encrypt(
        compliance.binarySecurityToken,
      );
      cred.complianceSecretEnc = this.encryption.encrypt(compliance.secret);
      cred.stage = 'compliance';
      await this.credRepo.save(cred);

      // 3. compliance checks for each document type
      await this.runComplianceChecks(cred, compliance, csr.privateKeyPem);

      // 4. production CSID
      const production = await this.client.requestProductionCsid(
        compliance.binarySecurityToken,
        compliance.secret,
        compliance.requestId,
      );
      cred.productionRequestId = production.requestId;
      cred.productionTokenEnc = this.encryption.encrypt(
        production.binarySecurityToken,
      );
      cred.productionSecretEnc = this.encryption.encrypt(production.secret);
      cred.stage = 'production';

      // Deactivate previous active credentials for this environment
      await this.credRepo.update(
        { environment: this.cfg.environment, isActive: true },
        { isActive: false },
      );
      cred.isActive = true;
      await this.credRepo.save(cred);

      this.logger.log(
        `ZATCA onboarding completed for ${this.cfg.environment} (cred ${cred.id})`,
      );
      return { credentialId: cred.id, stage: cred.stage };
    } catch (e: any) {
      cred.stage = 'failed';
      cred.lastError = e?.message || String(e);
      await this.credRepo.save(cred);
      this.logger.error(`Onboarding failed: ${cred.lastError}`);
      throw e;
    }
  }

  /** Sign + submit one sample invoice per document type to /compliance/invoices */
  private async runComplianceChecks(
    cred: ZatcaCredential,
    compliance: { binarySecurityToken: string; secret: string },
    privateKeyPem: string,
  ): Promise<void> {
    const certPem = this.signer.tokenToPem(compliance.binarySecurityToken);
    const samples: {
      type: InvoiceTransactionType;
      doc: InvoiceDocumentType;
    }[] = [
      { type: InvoiceTransactionType.STANDARD, doc: InvoiceDocumentType.INVOICE },
      { type: InvoiceTransactionType.STANDARD, doc: InvoiceDocumentType.CREDIT_NOTE },
      { type: InvoiceTransactionType.STANDARD, doc: InvoiceDocumentType.DEBIT_NOTE },
      { type: InvoiceTransactionType.SIMPLIFIED, doc: InvoiceDocumentType.INVOICE },
      { type: InvoiceTransactionType.SIMPLIFIED, doc: InvoiceDocumentType.CREDIT_NOTE },
      { type: InvoiceTransactionType.SIMPLIFIED, doc: InvoiceDocumentType.DEBIT_NOTE },
    ];

    let pih = INITIAL_PIH;
    let icv = 0;
    for (const s of samples) {
      icv += 1;
      const uuid = randomUUID();
      const input: BuildInvoiceInput = {
        invoiceNumber: `COMPLIANCE-${icv}`,
        uuid,
        icv,
        pih,
        issuedAt: new Date(),
        transactionType: s.type,
        documentType: s.doc,
        lines: [
          {
            name: 'Compliance test item',
            quantity: 1,
            unitPrice: 100,
            vatRate: 15,
            vatCategory: 'S',
          },
        ],
        originalInvoiceNumber:
          s.doc === InvoiceDocumentType.INVOICE ? undefined : 'COMPLIANCE-1',
        noteReason:
          s.doc === InvoiceDocumentType.INVOICE ? undefined : 'compliance test',
      };
      const unsigned = this.xml.build(input, this.cfg.seller);
      const signed = await this.signer.sign(unsigned, certPem, privateKeyPem, pih);
      const res = await this.client.complianceCheck(
        compliance.binarySecurityToken,
        compliance.secret,
        {
          invoiceHash: signed.invoiceHash,
          uuid,
          invoiceBase64: signed.signedXmlBase64,
        },
      );
      if (res.errors && res.errors.length) {
        throw new BadRequestException(
          `Compliance check failed for ${s.type}/${s.doc}: ${JSON.stringify(
            res.errors,
          )}`,
        );
      }
      pih = signed.invoiceHash;
    }
  }

  // ===========================================================================
  // Issue an invoice (build -> sign -> submit)
  // ===========================================================================

  async issueInvoice(dto: IssueInvoiceDto): Promise<EInvoice> {
    this.assertSellerConfigured();
    const cred = await this.getActiveCredential();
    const { token, secret, privateKeyPem, certPem } = this.decryptProduction(cred);

    const documentType =
      dto.documentType ?? EInvoiceDocumentType.INVOICE;

    // Reserve ICV + PIH atomically against the chain head.
    const reserved = await this.reserveChainSlot(dto, documentType);

    const input: BuildInvoiceInput = {
      invoiceNumber: reserved.invoiceNumber,
      uuid: reserved.uuid,
      icv: reserved.icv,
      pih: reserved.pih,
      issuedAt: new Date(),
      transactionType:
        dto.type === EInvoiceType.SIMPLIFIED
          ? InvoiceTransactionType.SIMPLIFIED
          : InvoiceTransactionType.STANDARD,
      documentType: this.mapDocType(documentType),
      currency: dto.currency || 'SAR',
      lines: dto.lines,
      customer: dto.customer,
      originalInvoiceNumber: dto.originalInvoiceNumber,
      noteReason: dto.noteReason,
    };

    const totals = this.xml.buildTotals(dto.lines);
    const record = reserved.entity;
    record.totalExclVat = totals.taxExclusive;
    record.totalVat = totals.vatTotal;
    record.totalInclVat = totals.taxInclusive;

    try {
      const unsigned = this.xml.build(input, this.cfg.seller);
      record.xml = unsigned;

      const signed = await this.signer.sign(
        unsigned,
        certPem,
        privateKeyPem,
        input.pih,
      );
      record.signedXml = signed.signedXml;
      record.invoiceHash = signed.invoiceHash;
      record.qrCode = signed.qrCode;
      record.status = EInvoiceStatus.SIGNED;
      record.submissionAttempts += 1;
      await this.invoiceRepo.save(record);

      const payload = {
        invoiceHash: signed.invoiceHash,
        uuid: reserved.uuid,
        invoiceBase64: signed.signedXmlBase64,
      };

      if (dto.type === EInvoiceType.STANDARD) {
        const res = await this.client.clearInvoice(token, secret, payload);
        record.zatcaResponse = res.raw;
        if (res.errors?.length) {
          record.status = EInvoiceStatus.REJECTED;
          record.lastError = JSON.stringify(res.errors);
        } else {
          record.status = EInvoiceStatus.CLEARED;
          record.clearedXmlBase64 = res.clearedInvoice || null;
        }
      } else {
        const res = await this.client.reportInvoice(token, secret, payload);
        record.zatcaResponse = res.raw;
        if (res.errors?.length) {
          record.status = EInvoiceStatus.REJECTED;
          record.lastError = JSON.stringify(res.errors);
        } else {
          record.status = EInvoiceStatus.REPORTED;
        }
      }
      await this.invoiceRepo.save(record);
      return record;
    } catch (e: any) {
      record.status = EInvoiceStatus.FAILED;
      record.lastError = e?.message || String(e);
      await this.invoiceRepo.save(record);
      throw e;
    }
  }

  // ===========================================================================
  // Payment-driven issuance (idempotent, queue/cron friendly)
  // ===========================================================================

  /**
   * Build + sign + submit an e-invoice for a completed payment.
   * Idempotent: returns the existing invoice if one was already issued for this
   * payment, and skips silently if ZATCA is disabled / not onboarded.
   *
   * Returns null when nothing was issued (disabled, not onboarded, or skipped).
   */
  async issueInvoiceForPayment(paymentId: string): Promise<EInvoice | null> {
    if (!this.cfg.enabled) return null;

    const existing = await this.invoiceRepo.findOne({
      where: { paymentId },
    });
    if (existing) return existing;

    const onboarded = await this.credRepo.findOne({
      where: { environment: this.cfg.environment, isActive: true },
    });
    if (!onboarded) {
      this.logger.warn(
        `Skipping invoice for payment ${paymentId}: ${this.cfg.environment} not onboarded`,
      );
      return null;
    }

    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) {
      this.logger.warn(`Payment ${paymentId} not found; cannot issue invoice`);
      return null;
    }
    if (payment.status !== PaymentStatus.COMPLETED) {
      this.logger.warn(
        `Payment ${paymentId} is ${payment.status}, not COMPLETED; skipping`,
      );
      return null;
    }
    if (!this.isInvoiceableSale(payment)) {
      // e.g. wallet recharges are not a taxable supply — no invoice.
      this.logger.debug(
        `Payment ${paymentId} has no linked supply; skipping invoice`,
      );
      return null;
    }

    // Itemize the payment and decide B2C/B2B from the buyer's tax profile.
    const composed = await this.composition.compose(payment);
    return this.issueInvoice({
      type: composed.type,
      documentType: EInvoiceDocumentType.INVOICE,
      currency: payment.currency || 'SAR',
      paymentId: payment.id,
      lines: composed.lines,
      customer: composed.customer,
    });
  }

  /** True only for payments tied to an actual supply (not wallet top-ups). */
  private isInvoiceableSale(payment: Payment): boolean {
    return !!(
      payment.bookingId ||
      payment.tripRequestId ||
      payment.offerBookingId ||
      payment.subscriptionPurchaseId ||
      payment.eventRequestId ||
      payment.giftOrderId
    );
  }

  /**
   * Find recently-completed payments that don't yet have an e-invoice and
   * return their ids (capped). Used by the cron sweeper / queue feeder.
   */
  async findPaymentsNeedingInvoice(limit = 50): Promise<string[]> {
    if (!this.cfg.enabled) return [];
    // Only look back a bounded window to keep the query cheap.
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.paymentRepo
      .createQueryBuilder('p')
      .leftJoin(
        EInvoice,
        'e',
        'e.paymentId = p.id AND e.environment = :env',
        { env: this.cfg.environment },
      )
      .where('p.status = :status', { status: PaymentStatus.COMPLETED })
      .andWhere('p.paidAt >= :since', { since })
      .andWhere('e.id IS NULL')
      // Only payments tied to an actual supply — exclude wallet recharges.
      .andWhere(
        `(p.bookingId IS NOT NULL OR p.tripRequestId IS NOT NULL
          OR p.offerBookingId IS NOT NULL OR p.subscriptionPurchaseId IS NOT NULL
          OR p.eventRequestId IS NOT NULL OR p.giftOrderId IS NOT NULL)`,
      )
      .orderBy('p.paidAt', 'ASC')
      .limit(limit)
      .select('p.id', 'id')
      .getRawMany<{ id: string }>();
    return rows.map((r) => r.id);
  }

  /**
   * Atomically allocate the next ICV and resolve the PIH from the current chain
   * head for this environment. Persists a DRAFT row inside the transaction so
   * concurrent issuers can't grab the same ICV.
   */
  private async reserveChainSlot(
    dto: IssueInvoiceDto,
    documentType: EInvoiceDocumentType,
  ): Promise<{
    entity: EInvoice;
    icv: number;
    pih: string;
    uuid: string;
    invoiceNumber: string;
  }> {
    return this.dataSource.transaction(async (mgr) => {
      // Lock the latest row for this environment to serialize ICV allocation.
      const last = await mgr
        .getRepository(EInvoice)
        .createQueryBuilder('e')
        .where('e.environment = :env', { env: this.cfg.environment })
        .orderBy('e.icv', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      const icv = (last ? Number(last.icv) : 0) + 1;
      const pih = last?.invoiceHash || INITIAL_PIH;
      const uuid = randomUUID();
      const prefix =
        documentType === EInvoiceDocumentType.CREDIT_NOTE
          ? 'CN'
          : documentType === EInvoiceDocumentType.DEBIT_NOTE
            ? 'DN'
            : 'INV';
      const invoiceNumber = `${prefix}-${new Date().getFullYear()}-${String(
        icv,
      ).padStart(6, '0')}`;

      const entity = mgr.getRepository(EInvoice).create({
        invoiceNumber,
        uuid,
        environment: this.cfg.environment,
        type: dto.type,
        documentType,
        status: EInvoiceStatus.DRAFT,
        icv,
        pih,
        currency: dto.currency || 'SAR',
        paymentId: dto.paymentId || null,
      });
      await mgr.getRepository(EInvoice).save(entity);
      return { entity, icv, pih, uuid, invoiceNumber };
    });
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  async findOne(id: string): Promise<EInvoice> {
    const inv = await this.invoiceRepo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    return inv;
  }

  /**
   * Customer-facing: latest ZATCA-accepted e-invoice for a purchase owned by
   * the given user. Returns only display-safe fields (no XML / internals).
   */
  async findForCustomer(
    userId: string,
    source: CustomerInvoiceSource,
    recordId: string,
  ): Promise<{ found: boolean; invoice: CustomerInvoiceView | null }> {
    const { relation, ownerColumn } = SOURCE_OWNERSHIP[source];

    const inv = await this.invoiceRepo
      .createQueryBuilder('inv')
      .innerJoin('inv.payment', 'p')
      .innerJoin(`p.${relation}`, 'src')
      .where('src.id = :recordId', { recordId })
      .andWhere(`src.${ownerColumn} = :userId`, { userId })
      .andWhere('inv.status IN (:...statuses)', {
        statuses: [EInvoiceStatus.REPORTED, EInvoiceStatus.CLEARED],
      })
      .orderBy('inv.icv', 'DESC')
      .getOne();

    if (!inv) return { found: false, invoice: null };

    return {
      found: true,
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        uuid: inv.uuid,
        type: inv.type,
        status: inv.status,
        totalExclVat: Number(inv.totalExclVat),
        totalVat: Number(inv.totalVat),
        totalInclVat: Number(inv.totalInclVat),
        currency: inv.currency,
        qrCode: inv.qrCode,
        issuedAt: inv.createdAt,
      },
    };
  }

  async list(limit = 50, offset = 0): Promise<{ items: EInvoice[]; total: number }> {
    const [items, total] = await this.invoiceRepo.findAndCount({
      order: { icv: 'DESC' },
      take: Math.min(limit, 200),
      skip: offset,
    });
    return { items, total };
  }

  /** Verify the signing toolchain (java + openssl + SDK jar) is usable. */
  async health() {
    const tool = await this.signer.checkToolchain();
    return {
      enabled: this.cfg.enabled,
      environment: this.cfg.environment,
      ...tool,
    };
  }

  async onboardingStatus(): Promise<{
    environment: string;
    onboarded: boolean;
    stage?: string;
    credentialId?: string;
  }> {
    const cred = await this.credRepo.findOne({
      where: { environment: this.cfg.environment, isActive: true },
    });
    return {
      environment: this.cfg.environment,
      onboarded: !!cred,
      stage: cred?.stage,
      credentialId: cred?.id,
    };
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private async getActiveCredential(): Promise<ZatcaCredential> {
    const cred = await this.credRepo.findOne({
      where: { environment: this.cfg.environment, isActive: true },
    });
    if (!cred || !cred.productionTokenEnc) {
      throw new BadRequestException(
        `No active ZATCA credential for ${this.cfg.environment}. Run onboarding first.`,
      );
    }
    return cred;
  }

  private decryptProduction(cred: ZatcaCredential): {
    token: string;
    secret: string;
    privateKeyPem: string;
    certPem: string;
  } {
    const token = this.encryption.decrypt(cred.productionTokenEnc!);
    const secret = this.encryption.decrypt(cred.productionSecretEnc!);
    const privateKeyPem = this.encryption.decrypt(cred.privateKeyEnc!);
    const certPem = this.signer.tokenToPem(token);
    return { token, secret, privateKeyPem, certPem };
  }

  private mapDocType(d: EInvoiceDocumentType): InvoiceDocumentType {
    switch (d) {
      case EInvoiceDocumentType.CREDIT_NOTE:
        return InvoiceDocumentType.CREDIT_NOTE;
      case EInvoiceDocumentType.DEBIT_NOTE:
        return InvoiceDocumentType.DEBIT_NOTE;
      default:
        return InvoiceDocumentType.INVOICE;
    }
  }

  private assertSellerConfigured(): void {
    const s = this.cfg.seller;
    if (!s.name || !/^3\d{13}3$/.test(s.vatNumber)) {
      throw new BadRequestException(
        'ZATCA seller not configured: set ZATCA_SELLER_NAME and a valid 15-digit ZATCA_SELLER_VAT (starts and ends with 3).',
      );
    }
    // KSA national address fields required by the schematron (BR-KSA-09):
    // street (BT-35), building (KSA-17), additional number (KSA-23, 4 digits),
    // neighborhood (KSA-3), postal (BT-38), city (BT-37).
    if (!/^\d{4}$/.test(s.plotIdentification || '')) {
      throw new BadRequestException(
        'ZATCA seller address invalid: ZATCA_SELLER_PLOT (additional number, KSA-23) must be 4 digits.',
      );
    }
    if (!s.citySubdivision || !s.street || !s.city || !/^\d{5}$/.test(s.postalZone)) {
      throw new BadRequestException(
        'ZATCA seller address incomplete: ZATCA_SELLER_STREET, ZATCA_SELLER_SUBDIVISION (neighborhood), ZATCA_SELLER_CITY and a 5-digit ZATCA_SELLER_POSTAL are required.',
      );
    }
  }
}
