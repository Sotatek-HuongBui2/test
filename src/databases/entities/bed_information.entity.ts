import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bed_information')
export class BedInformation extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'hash_id' })
  hashId: string;

  @Column()
  enable: boolean;

  @Column({ name: 'bed_id' })
  bedId: number;

  @Column()
  socket: number;

  @Column({ name: 'item_id' })
  itemId: number;

  @Column({ name: 'enable_jewel' })
  enableJewel: boolean;

  @Column({ name: 'jewel_slot_1' })
  jewelSlot1: number;

  @Column({ name: 'jewel_slot_2' })
  jewelSlot2: number;

  @Column({ name: 'jewel_slot_3' })
  jewelSlot3: number;

  @Column({ name: 'jewel_slot_4' })
  jewelSlot4: number;

  @Column({ name: 'jewel_slot_5' })
  jewelSlot5: number;
}
