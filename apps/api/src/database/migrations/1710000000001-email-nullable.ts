import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmailNullable1710000000001 implements MigrationInterface {
  name = 'EmailNullable1710000000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make users.email nullable
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL`);
    // Note: We keep existing unique constraint/index if present. A partial unique may also exist.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: make users.email NOT NULL (will fail if nulls exist)
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL`);
  }
}






