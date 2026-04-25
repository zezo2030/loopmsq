import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeparateSpecialAddons1710000000021
  implements MigrationInterface
{
  name = 'SeparateSpecialAddons1710000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "school_trip_addons" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid,
        "name" varchar(150) NOT NULL,
        "description" text,
        "imageUrl" text,
        "price" numeric(10,2) NOT NULL,
        "defaultQuantity" integer NOT NULL DEFAULT 1,
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" json,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_school_trip_addons_branchId"
      ON "school_trip_addons" ("branchId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "special_booking_addons" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "branchId" uuid,
        "name" varchar(150) NOT NULL,
        "description" text,
        "imageUrl" text,
        "price" numeric(10,2) NOT NULL,
        "defaultQuantity" integer NOT NULL DEFAULT 1,
        "isActive" boolean NOT NULL DEFAULT true,
        "metadata" json,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_special_booking_addons_branchId"
      ON "special_booking_addons" ("branchId")
    `);

    await queryRunner.query(`
      INSERT INTO "school_trip_addons" (
        "id", "branchId", "name", "description", "imageUrl", "price",
        "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      )
      SELECT
        "id", "branchId", "name", "description", "imageUrl", "price",
        "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      FROM "addons"
      WHERE "category" = 'school_trip'
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "special_booking_addons" (
        "id", "branchId", "name", "description", "imageUrl", "price",
        "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      )
      SELECT
        "id", "branchId", "name", "description", "imageUrl", "price",
        "defaultQuantity", "isActive",
        (COALESCE("metadata", '{}'::json)::jsonb || '{"privateEventAddon": true}'::jsonb)::json,
        "createdAt", "updatedAt"
      FROM "addons"
      WHERE "category" IN (
        'event_private', 'event_balloon', 'event_cake', 'event_decor',
        'private_event', 'private_booking'
      )
      OR "metadata" ->> 'privateEventAddon' = 'true'
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      DELETE FROM "addons"
      WHERE "category" = 'school_trip'
      OR "category" IN (
        'event_private', 'event_balloon', 'event_cake', 'event_decor',
        'private_event', 'private_booking'
      )
      OR "metadata" ->> 'privateEventAddon' = 'true'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "addons" (
        "id", "branchId", "name", "category", "description", "imageUrl",
        "price", "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      )
      SELECT
        "id", "branchId", "name", 'school_trip', "description", "imageUrl",
        "price", "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      FROM "school_trip_addons"
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO "addons" (
        "id", "branchId", "name", "category", "description", "imageUrl",
        "price", "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      )
      SELECT
        "id", "branchId", "name", 'private_event', "description", "imageUrl",
        "price", "defaultQuantity", "isActive", "metadata", "createdAt", "updatedAt"
      FROM "special_booking_addons"
      ON CONFLICT ("id") DO NOTHING
    `);

    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_special_booking_addons_branchId"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "special_booking_addons"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_school_trip_addons_branchId"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "school_trip_addons"');
  }
}
