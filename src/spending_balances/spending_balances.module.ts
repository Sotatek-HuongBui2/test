import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SpendingBalancesController } from './spending_balances.controller'
import { SpendingBalancesRepository } from './spending_balances.repository'
import { SpendingBalancesSevice } from './spending_balances.service'

@Module({
  imports: [TypeOrmModule.forFeature([SpendingBalancesRepository])],
  controllers: [SpendingBalancesController],
  providers: [SpendingBalancesSevice],
  exports: [SpendingBalancesSevice],
})
export class SpendingBalancesModule {}
