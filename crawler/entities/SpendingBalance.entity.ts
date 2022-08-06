import {BaseEntity, Column, Entity, PrimaryColumn, PrimaryGeneratedColumn} from 'typeorm';

@Entity('spending_balances')
export class SpendingBalances extends BaseEntity{
  @PrimaryColumn({name: 'wallet_id'})
  walletId: string;

  @Column()
  symbol: string;

  @Column()
  amount: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'available_amount' })
  availableAmount: string;

  @Column({ name: 'max_amount' })
  maxAmount: string;

  @Column()
  wallet: string;

  @Column({ name: 'token_address' })
  tokenAddress: string;
}
