import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserPermissions1710000000023 implements MigrationInterface {
  name = 'AddUserPermissions1710000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "permissions"`,
    );
  }
}
