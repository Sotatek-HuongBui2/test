import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumeInStakeTable1659584378619 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `staking` ADD `percent_reward` varchar(255) null');
    await queryRunner.query('ALTER TABLE `staking` ADD `reward_time` varchar(255) null');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `staking` DROP COLUMN `percent_reward`');
    await queryRunner.query('ALTER TABLE `staking` DROP COLUMN `reward_time`');
  }

}
