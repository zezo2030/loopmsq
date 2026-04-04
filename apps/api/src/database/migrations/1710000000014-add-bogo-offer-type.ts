import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBogoOfferType1710000000014 implements MigrationInterface {
  name = 'AddBogoOfferType1710000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "offers_discountType_enum" ADD VALUE 'bogo';
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "offers"
      ADD COLUMN IF NOT EXISTS "buyCount" integer DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "offers"
      ADD COLUMN IF NOT EXISTS "freeCount" integer DEFAULT 1
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "bonusTickets" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN IF NOT EXISTS "appliedOfferId" uuid
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "bookings"
        ADD CONSTRAINT "FK_bookings_applied_offer"
        FOREIGN KEY ("appliedOfferId") REFERENCES "offers"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP CONSTRAINT IF EXISTS "FK_bookings_applied_offer"
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "appliedOfferId"
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "bonusTickets"
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "freeCount"
    `);
    await queryRunner.query(`
      ALTER TABLE "offers" DROP COLUMN IF EXISTS "buyCount"
    `);
    // PostgreSQL cannot remove enum values safely; leave 'bogo' in enum
  }
}
