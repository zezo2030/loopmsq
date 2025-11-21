import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class WalletTransactions1710000000002 implements MigrationInterface {
  name = 'WalletTransactions1710000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wallet_transactions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'walletId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'enum',
            enum: ['deposit', 'withdrawal'],
            isNullable: false,
          },
          {
            name: 'amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'method',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['success', 'failed'],
            default: "'success'",
            isNullable: false,
          },
          {
            name: 'reference',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'relatedBookingId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'failureReason',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create indexes
    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_walletId',
        columnNames: ['walletId'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_userId',
        columnNames: ['userId'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_type',
        columnNames: ['type'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_createdAt',
        columnNames: ['createdAt'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_userId_type',
        columnNames: ['userId', 'type'],
      }),
    );

    await queryRunner.createIndex(
      'wallet_transactions',
      new TableIndex({
        name: 'IDX_wallet_transactions_userId_status',
        columnNames: ['userId', 'status'],
      }),
    );

    // Create foreign keys
    await queryRunner.createForeignKey(
      'wallet_transactions',
      new TableForeignKey({
        columnNames: ['walletId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'wallets',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'wallet_transactions',
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'wallet_transactions',
      new TableForeignKey({
        columnNames: ['relatedBookingId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'bookings',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('wallet_transactions');
    if (table) {
      const foreignKeys = table.foreignKeys;
      for (const fk of foreignKeys) {
        await queryRunner.dropForeignKey('wallet_transactions', fk);
      }
    }

    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_userId_status');
    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_userId_type');
    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_createdAt');
    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_status');
    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_type');
    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_userId');
    await queryRunner.dropIndex('wallet_transactions', 'IDX_wallet_transactions_walletId');

    await queryRunner.dropTable('wallet_transactions');
  }
}
