import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminNotifications1710000000022
  implements MigrationInterface
{
  name = 'CreateAdminNotifications1710000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_notifications" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" varchar(50) NOT NULL,
        "severity" varchar(20) NOT NULL DEFAULT 'info',
        "title" varchar(255) NOT NULL,
        "body" text NOT NULL,
        "branchId" uuid,
        "resourceType" varchar(50),
        "resourceId" uuid,
        "data" jsonb,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" timestamp,
        "createdAt" timestamp NOT NULL DEFAULT now(),
        "updatedAt" timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_notifications_type"
      ON "admin_notifications" ("type")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_notifications_branchId"
      ON "admin_notifications" ("branchId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_notifications_isRead"
      ON "admin_notifications" ("isRead")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_notifications_createdAt"
      ON "admin_notifications" ("createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_notifications_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_notifications_isRead"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_notifications_branchId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_admin_notifications_type"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_notifications"`);
  }
}
