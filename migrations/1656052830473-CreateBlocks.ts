import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBlocks1656052830473 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `blocks` ( ' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`contract` varchar(200) NOT NULL,' +
        '`block` int NOT NULL,' +
        '`created_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),' +
        '`updated_at` datetime(6) NOT NULL DEFAULT current_timestamp(6),' +
        ' PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `blocks`');
  }
}
