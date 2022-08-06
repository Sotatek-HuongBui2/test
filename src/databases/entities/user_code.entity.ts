import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('user_code')
export class UserCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  code: string;

  @Column()
  expired: string;

  @Column({name: 'code_used_at'})
  codeUsedAt: string;

  @Column({name: 'is_used'})
  isUsed: boolean;

  @Column()
  friend: string;
}
