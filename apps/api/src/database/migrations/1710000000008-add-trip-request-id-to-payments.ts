import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddTripRequestIdToPayments1710000000008 implements MigrationInterface {
    name = 'AddTripRequestIdToPayments1710000000008';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add tripRequestId column to payments table
        await queryRunner.addColumn(
            'payments',
            new TableColumn({
                name: 'tripRequestId',
                type: 'uuid',
                isNullable: true,
            }),
        );

        // Add index for tripRequestId
        await queryRunner.createIndex(
            'payments',
            new TableIndex({
                name: 'IDX_payments_tripRequestId',
                columnNames: ['tripRequestId'],
            }),
        );

        // Add composite index for tripRequestId and status
        await queryRunner.createIndex(
            'payments',
            new TableIndex({
                name: 'IDX_payments_tripRequestId_status',
                columnNames: ['tripRequestId', 'status'],
            }),
        );

        // Add foreign key constraint
        await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_tripRequestId" 
      FOREIGN KEY ("tripRequestId") 
      REFERENCES "school_trip_requests"("id") 
      ON DELETE SET NULL
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key
        await queryRunner.query(`
      ALTER TABLE "payments" 
      DROP CONSTRAINT IF EXISTS "FK_payments_tripRequestId"
    `);

        // Drop indexes
        await queryRunner.dropIndex('payments', 'IDX_payments_tripRequestId_status');
        await queryRunner.dropIndex('payments', 'IDX_payments_tripRequestId');

        // Drop column
        await queryRunner.dropColumn('payments', 'tripRequestId');
    }
}
