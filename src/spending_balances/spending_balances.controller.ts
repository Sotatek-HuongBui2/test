import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiQuery, ApiTags } from '@nestjs/swagger'

import { SpendingBalancesSevice } from './spending_balances.service'

@ApiTags('spending_balances')
@Controller('spending_balances')
export class SpendingBalancesController {
  constructor(private readonly spendingBalancesSevice: SpendingBalancesSevice) {}
}
