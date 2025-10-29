import { MigrationInterface, QueryRunner } from 'typeorm';

export class OffersCouponsBranchHall1710000000000 implements MigrationInterface {
  name = 'OffersCouponsBranchHall1710000000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Delete existing offers and coupons that don't have branchId (old data)
    // This is necessary because branchId is now required and we can't assign them to a branch
    await queryRunner.query(`DELETE FROM "offers"`);
    await queryRunner.query(`DELETE FROM "coupons"`);

    // Add columns (nullable first for safety)
    await queryRunner.query(`ALTER TABLE "offers" ADD "branchId" uuid`);
    await queryRunner.query(`ALTER TABLE "offers" ADD "hallId" uuid`);
    await queryRunner.query(`ALTER TABLE "coupons" ADD "branchId" uuid`);
    await queryRunner.query(`ALTER TABLE "coupons" ADD "hallId" uuid`);

    // Make branchId NOT NULL after adding the column
    await queryRunner.query(`ALTER TABLE "offers" ALTER COLUMN "branchId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "coupons" ALTER COLUMN "branchId" SET NOT NULL`);

    // Add foreign key constraints
    await queryRunner.query(`ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "offers" ADD CONSTRAINT "FK_offers_hall" FOREIGN KEY ("hallId") REFERENCES "halls"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_coupons_branch" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_coupons_hall" FOREIGN KEY ("hallId") REFERENCES "halls"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_coupons_hall"`);
    await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_coupons_branch"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_hall"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP CONSTRAINT "FK_offers_branch"`);

    await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "hallId"`);
    await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "branchId"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "hallId"`);
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN "branchId"`);
  }
}


