import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tx_histories')
export class TxHistories extends BaseEntity{
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  symbol: string;

  @Column({ name: 'token_address' })
  tokenAddress: string;

  @Column()
  amount: string;

  @Column({ name: 'token_id' })
  tokenId: string;

  @Column({ name: 'contract_address' })
  contractAddress: string;

  @Column()
  type: string;

  @Column()
  tx: string;

  @Column()
  status: string;

  @Column({name: 'nft_sale_id'})
  nftSaleId: number;

  @Column({name: 'lucky_box_id'})
  luckyBoxId: number;

  @Column({name: 'nft_id'})
  nftId: number;

  @Column({name: 'target_type'})
  targetType: string;
}
