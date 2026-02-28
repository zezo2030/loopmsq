import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateOrganizingBranchesTable1710000000010 implements MigrationInterface {
  name = 'CreateOrganizingBranchesTable1710000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'organizing_branches',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'imageUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'videoUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'videoCoverUrl',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('organizing_branches');
  }
}





