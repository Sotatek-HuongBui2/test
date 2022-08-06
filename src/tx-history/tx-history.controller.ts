import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard'
import { abi } from 'src/common/Utils'

import { CreateTxHistoryDto } from '../tx-history/dto/tx-history.dto'
import { GetTxHistoryDto } from './dto/get-tx-history'
import { TxHistorySevice } from './tx-history.service'
@ApiTags('tx-history')
@Controller('tx-history')
export class TxHistoryController {
  constructor(private readonly txHistorySevice: TxHistorySevice) { }
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('tx-history')
  async insertIntoTxHistory(@Body() createTxHistoryDto: CreateTxHistoryDto) {
    return await this.txHistorySevice.insertIntoTxHistory(createTxHistoryDto)
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPendingTxHistory(
    @Query() payload: GetTxHistoryDto,
    @Req() req: any
  ) {
    return await this.txHistorySevice.getPendingTxHistory(req.user.id, payload)
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getTxHistory(
    @Query() payload: GetTxHistoryDto,
    @Req() req: any
  ) {
    return await this.txHistorySevice.getTxHistory(req.user.id, payload)
  }
}
