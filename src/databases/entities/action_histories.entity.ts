import {BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

import {ACTION_TYPE} from "../../action-histories/constants";

@Entity('action_histories')
export class ActionHistories extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: ACTION_TYPE;

  @Column({name: 'target_type'})
  targetType: string;

  @Column({name: 'user_id'})
  userId: number;

  @Column({name: 'target_id'})
  targetId: number;

  @Column({name: 'price'})
  price: number;

  @Column({name: 'amount'})
  amount: number;

  @Column()
  symbol: string;

  @Column({name: 'nft_sale_id'})
  nftSaleId: number;

  @Column({name: 'lucky_box_id'})
  luckyBoxId: number;

  @Column({name: 'nft_id'})
  nftId: number;

  @Column({name: 'to_symbol'})
  toSymbol: string;

  @Column({name: 'to_amount'})
  toAmount: number;

  @CreateDateColumn({name: 'created_at', nullable: true})
  createdAt: Date;

  @UpdateDateColumn({name: 'updated_at', nullable: true})
  updatedAt: Date;
}
