import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveHallsAndCleanup1710000000005 implements MigrationInterface {
  name = 'RemoveHallsAndCleanup1710000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Delete all data from all tables (as requested by user)
    await queryRunner.query(`TRUNCATE TABLE "tickets" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "payments" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "bookings" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "offers" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "coupons" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "event_requests" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "addons" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "halls" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "school_trip_requests" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "branches" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "users" CASCADE`);
    await queryRunner.query(`TRUNCATE TABLE "wallet_transactions" CASCADE`);

    // Step 2: Drop foreign key constraints that reference halls
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      DROP CONSTRAINT IF EXISTS "FK_bookings_hallId"
    `);
    
    await queryRunner.query(`
      ALTER TABLE "offers" 
      DROP CONSTRAINT IF EXISTS "FK_offers_hallId"
    `);
    
    await queryRunner.query(`
      ALTER TABLE "coupons" 
      DROP CONSTRAINT IF EXISTS "FK_coupons_hallId"
    `);

    // Step 3: Remove hallId columns from bookings, offers, coupons
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      DROP COLUMN IF EXISTS "hallId"
    `);

    await queryRunner.query(`
      ALTER TABLE "offers" 
      DROP COLUMN IF EXISTS "hallId"
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons" 
      DROP COLUMN IF EXISTS "hallId"
    `);

    await queryRunner.query(`
      ALTER TABLE "event_requests" 
      DROP COLUMN IF EXISTS "hallId"
    `);

    // Step 4: Drop the halls table
    await queryRunner.query(`DROP TABLE IF EXISTS "halls" CASCADE`);

    // Step 5: Add hall-related columns to branches table
    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "priceConfig" JSONB
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "isDecorated" BOOLEAN DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "hallFeatures" JSONB
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "hallImages" JSONB
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "hallVideoUrl" VARCHAR(500)
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      ADD COLUMN IF NOT EXISTS "hallStatus" VARCHAR(20) DEFAULT 'available'
    `);

    // Step 6: Remove hallId from addons table
    await queryRunner.query(`
      ALTER TABLE "addons" 
      DROP COLUMN IF EXISTS "hallId"
    `);

    // Step 7: Drop the OneToOne relationship column from branches
    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP CONSTRAINT IF EXISTS "FK_branches_hall"
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "hallId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: Remove hall columns from branches
    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "priceConfig"
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "isDecorated"
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "hallFeatures"
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "hallImages"
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "hallVideoUrl"
    `);

    await queryRunner.query(`
      ALTER TABLE "branches" 
      DROP COLUMN IF EXISTS "hallStatus"
    `);

    // Recreate halls table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "halls" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid NOT NULL,
        "name_ar" VARCHAR(100) NOT NULL,
        "name_en" VARCHAR(100) NOT NULL,
        "priceConfig" JSONB NOT NULL,
        "isDecorated" BOOLEAN DEFAULT false,
        "capacity" INTEGER NOT NULL,
        "status" VARCHAR(20) DEFAULT 'available',
        "description_ar" TEXT,
        "description_en" TEXT,
        "features" JSONB,
        "images" JSONB,
        "videoUrl" VARCHAR(500),
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW(),
        CONSTRAINT "FK_halls_branchId" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE
      )
    `);

    // Re-add hallId columns
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD COLUMN IF NOT EXISTS "hallId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "offers" 
      ADD COLUMN IF NOT EXISTS "hallId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons" 
      ADD COLUMN IF NOT EXISTS "hallId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "addons" 
      ADD COLUMN IF NOT EXISTS "hallId" uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "event_requests" 
      ADD COLUMN IF NOT EXISTS "hallId" uuid
    `);

    // Re-add foreign keys
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD CONSTRAINT "FK_bookings_hallId" 
      FOREIGN KEY ("hallId") REFERENCES "halls"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "offers" 
      ADD CONSTRAINT "FK_offers_hallId" 
      FOREIGN KEY ("hallId") REFERENCES "halls"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "coupons" 
      ADD CONSTRAINT "FK_coupons_hallId" 
      FOREIGN KEY ("hallId") REFERENCES "halls"("id") ON DELETE SET NULL
    `);
  }
}

