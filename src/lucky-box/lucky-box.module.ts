import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { LuckyBox } from 'src/databases/entities/lucky_box.entity'
import { SpendingBalancesModule } from 'src/spending_balances/spending_balances.module'

import { LuckyBoxController } from './lucky-box.controller'
import { LuckyBoxSevice } from './lucky-box.service'

@Module({
  imports: [TypeOrmModule.forFeature([LuckyBox]), SpendingBalancesModule],
  controllers: [LuckyBoxController],
  providers: [LuckyBoxSevice],
  exports: [LuckyBoxSevice],
})
export class LuckyBoxModule { }
