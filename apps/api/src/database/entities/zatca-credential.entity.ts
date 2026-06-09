import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Holds the ZATCA onboarding artifacts for a given environment/EGS unit
 * (Electronic Generation Solution). Sensitive fields (private key, secrets,
 * CSID tokens) are stored AES-encrypted by the application layer.
 *
 * Onboarding flow produces:
 *  1. EC private key + CSR (generated locally)
 *  2. Compliance CSID (request id + binary security token + secret) via OTP
 *  3. Production CSID (request id + binary security token + secret)
 */
@Entity('zatca_credentials')
@Index(['environment', 'isActive'])
export class ZatcaCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** sandbox | simulation | production */
  @Column({ type: 'varchar', length: 20 })
  environment: string;

  /** Logical EGS / device identifier used in the CSR common name */
  @Column({ type: 'varchar', length: 100 })
  egsSerialNumber: string;

  // ---- locally generated key material (AES-encrypted) ----
  @Column({ type: 'text', nullable: true })
  privateKeyEnc: string | null;

  @Column({ type: 'text', nullable: true })
  csrPem: string | null;

  // ---- compliance CSID ----
  @Column({ type: 'varchar', length: 100, nullable: true })
  complianceRequestId: string | null;

  @Column({ type: 'text', nullable: true })
  complianceTokenEnc: string | null;

  @Column({ type: 'text', nullable: true })
  complianceSecretEnc: string | null;

  // ---- production CSID ----
  @Column({ type: 'varchar', length: 100, nullable: true })
  productionRequestId: string | null;

  @Column({ type: 'text', nullable: true })
  productionTokenEnc: string | null;

  @Column({ type: 'text', nullable: true })
  productionSecretEnc: string | null;

  /** Whether production onboarding completed and this is the live credential */
  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  /** Onboarding stage marker: created | compliance | production | failed */
  @Column({ type: 'varchar', length: 20, default: 'created' })
  stage: string;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
