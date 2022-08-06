import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('gacha_prob_config')
export class GachaProbConfig extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'key' })
  key: string;

  @Column({ name: 'value' })
  value: string;

  @UpdateDateColumn({ name: 'created_at', nullable: true })
  createdAt: Date;
}
