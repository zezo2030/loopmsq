import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEInvoiceTables1710000000027 implements MigrationInterface {
  name = 'CreateEInvoiceTables1710000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- zatca_credentials ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "zatca_credentials" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "environment" varchar(20) NOT NULL,
        "egsSerialNumber" varchar(100) NOT NULL,
        "privateKeyEnc" text,
        "csrPem" text,
        "complianceRequestId" varchar(100),
        "complianceTokenEnc" text,
        "complianceSecretEnc" text,
        "productionRequestId" varchar(100),
        "productionTokenEnc" text,
        "productionSecretEnc" text,
        "isActive" boolean NOT NULL DEFAULT false,
        "stage" varchar(20) NOT NULL DEFAULT 'created',
        "lastError" text,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_zatca_credentials_env_active"
      ON "zatca_credentials" ("environment", "isActive")
    `);

    // ---- einvoices ----
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "einvoices_type_enum" AS ENUM ('standard', 'simplified');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "einvoices_documenttype_enum" AS ENUM ('invoice', 'credit_note', 'debit_note');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "einvoices_status_enum" AS ENUM (
          'draft', 'signed', 'compliance_passed', 'cleared',
          'reported', 'rejected', 'failed'
        );
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "einvoices" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "invoiceNumber" varchar(50) NOT NULL,
        "uuid" uuid NOT NULL,
        "environment" varchar(20) NOT NULL,
        "type" "einvoices_type_enum" NOT NULL,
        "documentType" "einvoices_documenttype_enum" NOT NULL DEFAULT 'invoice',
        "status" "einvoices_status_enum" NOT NULL DEFAULT 'draft',
        "icv" bigint NOT NULL,
        "pih" text NOT NULL,
        "invoiceHash" text,
        "qrCode" text,
        "xml" text,
        "signedXml" text,
        "clearedXmlBase64" text,
        "totalExclVat" numeric(12,2) NOT NULL DEFAULT 0,
        "totalVat" numeric(12,2) NOT NULL DEFAULT 0,
        "totalInclVat" numeric(12,2) NOT NULL DEFAULT 0,
        "currency" varchar(3) NOT NULL DEFAULT 'SAR',
        "zatcaResponse" jsonb,
        "lastError" text,
        "submissionAttempts" int NOT NULL DEFAULT 0,
        "paymentId" uuid,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_einvoices_payment" FOREIGN KEY ("paymentId")
          REFERENCES "payments"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_einvoices_env_icv"
      ON "einvoices" ("environment", "icv")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_einvoices_uuid"
      ON "einvoices" ("uuid")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_einvoices_status"
      ON "einvoices" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_einvoices_paymentId"
      ON "einvoices" ("paymentId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "einvoices"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "einvoices_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "einvoices_documenttype_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "einvoices_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "zatca_credentials"`);
  }
}
