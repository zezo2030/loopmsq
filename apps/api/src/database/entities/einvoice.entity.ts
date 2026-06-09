import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Payment } from './payment.entity';

export enum EInvoiceType {
  STANDARD = 'standard', // B2B -> clearance
  SIMPLIFIED = 'simplified', // B2C -> reporting
}

export enum EInvoiceDocumentType {
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

export enum EInvoiceStatus {
  DRAFT = 'draft', // built, not yet signed
  SIGNED = 'signed', // signed locally, not submitted
  COMPLIANCE_PASSED = 'compliance_passed', // passed compliance check
  CLEARED = 'cleared', // ZATCA cleared (standard)
  REPORTED = 'reported', // ZATCA reported (simplified)
  REJECTED = 'rejected', // ZATCA rejected
  FAILED = 'failed', // local/transport error
}

/**
 * One persisted e-invoice document. The (environment, icv) pair is unique and
 * the chain is linked by pih -> previous invoiceHash to satisfy KSA-13/KSA-16.
 */
@Entity('einvoices')
@Index(['environment', 'icv'], { unique: true })
@Index(['status'])
@Index(['paymentId'])
@Index(['uuid'], { unique: true })
export class EInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-readable invoice number (BT-1) */
  @Column({ type: 'varchar', length: 50 })
  invoiceNumber: string;

  /** cbc:UUID of the document */
  @Column({ type: 'uuid' })
  uuid: string;

  @Column({ type: 'varchar', length: 20 })
  environment: string;

  @Column({ type: 'enum', enum: EInvoiceType })
  type: EInvoiceType;

  @Column({
    type: 'enum',
    enum: EInvoiceDocumentType,
    default: EInvoiceDocumentType.INVOICE,
  })
  documentType: EInvoiceDocumentType;

  @Column({
    type: 'enum',
    enum: EInvoiceStatus,
    default: EInvoiceStatus.DRAFT,
  })
  status: EInvoiceStatus;

  /** Invoice Counter Value (KSA-16), monotonic per environment */
  @Column({ type: 'bigint' })
  icv: number;

  /** Previous Invoice Hash (KSA-13) fed into this invoice */
  @Column({ type: 'text' })
  pih: string;

  /** Hash of THIS signed invoice (becomes the next pih) */
  @Column({ type: 'text', nullable: true })
  invoiceHash: string | null;

  /** base64 TLV QR string */
  @Column({ type: 'text', nullable: true })
  qrCode: string | null;

  /** The unsigned UBL XML */
  @Column({ type: 'text', nullable: true })
  xml: string | null;

  /** The signed UBL XML (with signature + QR) */
  @Column({ type: 'text', nullable: true })
  signedXml: string | null;

  /** base64 of the cleared invoice returned by ZATCA (standard only) */
  @Column({ type: 'text', nullable: true })
  clearedXmlBase64: string | null;

  // ---- monetary summary (for quick reporting) ----
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalExclVat: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalVat: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalInclVat: number;

  @Column({ type: 'varchar', length: 3, default: 'SAR' })
  currency: string;

  // ---- ZATCA response bookkeeping ----
  @Column({ type: 'jsonb', nullable: true })
  zatcaResponse: any;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'int', default: 0 })
  submissionAttempts: number;

  // ---- linkage to the originating payment (optional) ----
  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
